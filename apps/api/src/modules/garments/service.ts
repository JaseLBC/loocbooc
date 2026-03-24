/**
 * Garments module — Service layer.
 *
 * All business logic lives here. Routes are thin wrappers.
 *
 * Architecture decisions:
 * - UGI is the external identifier; cuid is internal. UGI is stored in metadata.ugi.
 * - Pipeline status is stored in metadata.pipeline as a JSON object.
 * - Fabric physics are derived on-the-fly and stored in metadata.fabricPhysics for caching.
 * - File uploads go to S3 (presigned URL flow). This module tracks what's uploaded in metadata.
 * - The 3D scan pipeline is represented as stages in metadata.pipeline.stages.
 * - Try-on count is stored in metadata.tryOnCount and incremented by the avatar module.
 *
 * Garment status mapping (frontend GarmentStatus → Prisma GarmentStatus):
 *   'draft'      → draft
 *   'processing' → development (with pipeline running)
 *   'active'     → retail (pipeline complete)
 *   'updating'   → development (pipeline running on update)
 *   'error'      → draft (with pipeline error flag)
 *   'archived'   → discontinued
 *   'deleted'    → deleted (soft delete)
 */

import { prisma, Prisma } from "@loocbooc/database";
import { generateUGI } from "./ugi.js";
import { deriveFabricPhysics } from "./fabric-physics.js";
import type { GarmentSummary, FabricPhysics, GarmentMeasurements, ScanStatus, BrandStats, PipelineStage } from "./types.js";
import type { CreateGarmentInput, UpdateGarmentInput, GarmentFiltersInput } from "./schema.js";

// ─────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// ─────────────────────────────────────────────
// Metadata types (stored in garment.metadata)
// ─────────────────────────────────────────────

/**
 * Internal metadata type for garments. Using Partial<> and explicit undefined
 * to satisfy exactOptionalPropertyTypes.
 */
interface GarmentMetadata {
  ugi: string;
  fabricComposition?: string | undefined;
  fabricPhysics?: FabricPhysics | undefined;
  measurements?: Partial<GarmentMeasurements> | undefined;
  uploadMethod?: "clo3d" | "measurements" | "pattern" | "photos" | undefined;
  pipeline: {
    stages: PipelineStage[];
    status: string;     // 'idle' | 'running' | 'complete' | 'error'
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    errorMessage?: string | undefined;
    estimatedSecondsRemaining?: number | undefined;
  };
  assets: {
    thumbnailUrl?: string | undefined;
    modelUrl?: string | undefined;
    usdzUrl?: string | undefined;
    files?: Array<{ name: string; size: number; type: string; uploadedAt: string }> | undefined;
  };
  tryOnCount: number;
  publicStatus: string; // the frontend-facing status string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getMetadata(garment: { metadata: Prisma.JsonValue }): GarmentMetadata {
  const raw = garment.metadata as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    return {
      ugi: generateUGI(),
      pipeline: { stages: [], status: "idle" },
      assets: {},
      tryOnCount: 0,
      publicStatus: "draft",
    };
  }
  return raw as unknown as GarmentMetadata;
}

function prismaStatusToPublic(
  prismaStatus: string,
  meta: GarmentMetadata,
): string {
  if (meta.publicStatus) return meta.publicStatus;

  switch (prismaStatus) {
    case "draft": return "draft";
    case "development": {
      const pipelineStatus = meta.pipeline?.status ?? "idle";
      if (pipelineStatus === "running") return "processing";
      if (pipelineStatus === "error") return "error";
      return "draft";
    }
    case "sampling":
    case "production":
    case "retail": {
      const pipelineStatus = meta.pipeline?.status ?? "idle";
      if (pipelineStatus === "running") return "updating";
      return "active";
    }
    case "discontinued": return "archived";
    default: return "draft";
  }
}

function toGarmentSummary(garment: {
  id: string;
  brandId: string;
  name: string;
  category: string | null;
  season: string | null;
  styleCode: string | null;
  description: string | null;
  status: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): GarmentSummary {
  const meta = getMetadata(garment);
  const publicStatus = prismaStatusToPublic(garment.status, meta);
  const assets = meta.assets ?? {};

  return {
    ugi: meta.ugi,
    id: garment.id,
    brandId: garment.brandId,
    name: garment.name,
    category: garment.category,
    season: garment.season,
    sku: garment.styleCode,
    description: garment.description,
    fabricComposition: meta.fabricComposition ?? null,
    fabricPhysics: meta.fabricPhysics ?? null,
    measurements: meta.measurements ?? null,
    uploadMethod: meta.uploadMethod ?? null,
    status: publicStatus,
    hasModel3D: !!assets.modelUrl,
    thumbnailUrl: assets.thumbnailUrl ?? null,
    modelUrl: assets.modelUrl ?? null,
    usdzUrl: assets.usdzUrl ?? null,
    tryOnCount: meta.tryOnCount ?? 0,
    createdAt: garment.createdAt.toISOString(),
    updatedAt: garment.updatedAt.toISOString(),
  };
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export async function createGarment(
  brandId: string,
  input: CreateGarmentInput,
): Promise<GarmentSummary> {
  const ugi = generateUGI();

  // Derive fabric physics if composition is provided
  let fabricPhysics: FabricPhysics | undefined;
  if (input.fabricComposition) {
    fabricPhysics = deriveFabricPhysics(input.fabricComposition);
  }

  const metadata: GarmentMetadata = {
    ugi,
    ...(input.fabricComposition !== undefined && { fabricComposition: input.fabricComposition }),
    ...(fabricPhysics !== undefined && { fabricPhysics }),
    ...(input.measurements !== undefined && { measurements: input.measurements }),
    ...(input.uploadMethod !== undefined && { uploadMethod: input.uploadMethod }),
    pipeline: {
      status: "idle",
      stages: defaultPipelineStages(input.uploadMethod),
    },
    assets: {},
    tryOnCount: 0,
    publicStatus: "draft",
  };

  const garment = await prisma.garment.create({
    data: {
      brandId,
      name: input.name,
      category: input.category,
      season: input.season ?? null,
      styleCode: input.sku ?? null,
      description: input.description ?? null,
      status: "draft",
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
  });

  return toGarmentSummary(garment);
}

export async function getGarmentByUGI(
  ugi: string,
  brandId: string,
  isAdmin = false,
): Promise<GarmentSummary> {
  // Find by ugi stored in metadata
  // We need to query metadata JSONB — use a raw query for this
  const garments = await prisma.$queryRaw<Array<{
    id: string;
    brand_id: string;
    name: string;
    category: string | null;
    season: string | null;
    style_code: string | null;
    description: string | null;
    status: string;
    metadata: unknown;
    created_at: Date;
    updated_at: Date;
  }>>(
    Prisma.sql`
      SELECT id, brand_id, name, category, season, style_code, description,
             status, metadata, created_at, updated_at
      FROM garments
      WHERE metadata->>'ugi' = ${ugi}
      LIMIT 1
    `,
  );

  if (garments.length === 0) {
    throw new ServiceError("GARMENT_NOT_FOUND", "Garment not found.", 404);
  }

  const g = garments[0]!;

  if (!isAdmin && g.brand_id !== brandId) {
    throw new ServiceError("FORBIDDEN", "You do not have access to this garment.", 403);
  }

  return toGarmentSummary({
    id: g.id,
    brandId: g.brand_id,
    name: g.name,
    category: g.category,
    season: g.season,
    styleCode: g.style_code,
    description: g.description,
    status: g.status,
    metadata: g.metadata as Prisma.JsonValue,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  });
}

export async function listGarments(
  brandId: string,
  filters: GarmentFiltersInput,
): Promise<{
  items: GarmentSummary[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const { page, limit, sortBy, sortOrder, search, category, season, status } = filters;

  // Build raw SQL for metadata-based filtering
  // We need to filter on metadata JSONB fields (status, category via metadata.publicStatus)
  // and also on regular columns (category, season)

  const conditions: Prisma.Sql[] = [
    Prisma.sql`brand_id = ${brandId}`,
  ];

  if (search) {
    conditions.push(
      Prisma.sql`(name ILIKE ${`%${search}%`} OR style_code ILIKE ${`%${search}%`} OR description ILIKE ${`%${search}%`} OR metadata->>'ugi' ILIKE ${`%${search}%`})`,
    );
  }

  if (category) {
    conditions.push(Prisma.sql`category = ${category}`);
  }

  if (season) {
    conditions.push(Prisma.sql`season = ${season}`);
  }

  // Status filtering — apply to metadata->>'publicStatus'
  if (status) {
    // Map frontend statuses to Prisma statuses and pipeline conditions
    switch (status) {
      case "draft":
        conditions.push(
          Prisma.sql`(status = 'draft' AND (metadata->>'publicStatus' IS NULL OR metadata->>'publicStatus' = 'draft'))`,
        );
        break;
      case "processing":
        conditions.push(
          Prisma.sql`metadata->>'publicStatus' = 'processing'`,
        );
        break;
      case "active":
        conditions.push(
          Prisma.sql`metadata->>'publicStatus' = 'active'`,
        );
        break;
      case "archived":
        conditions.push(Prisma.sql`status = 'discontinued'`);
        break;
      case "error":
        conditions.push(
          Prisma.sql`metadata->>'publicStatus' = 'error'`,
        );
        break;
      default:
        break;
    }
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  // Build ORDER BY
  let orderByClause: Prisma.Sql;
  switch (sortBy) {
    case "name":
      orderByClause = sortOrder === "asc"
        ? Prisma.sql`ORDER BY name ASC`
        : Prisma.sql`ORDER BY name DESC`;
      break;
    case "status":
      orderByClause = sortOrder === "asc"
        ? Prisma.sql`ORDER BY status ASC, created_at DESC`
        : Prisma.sql`ORDER BY status DESC, created_at DESC`;
      break;
    default:
      orderByClause = sortOrder === "asc"
        ? Prisma.sql`ORDER BY created_at ASC`
        : Prisma.sql`ORDER BY created_at DESC`;
  }

  const offset = (page - 1) * limit;

  // Run count + data queries in parallel
  const [countResult, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*) FROM garments ${whereClause}`,
    ),
    prisma.$queryRaw<Array<{
      id: string;
      brand_id: string;
      name: string;
      category: string | null;
      season: string | null;
      style_code: string | null;
      description: string | null;
      status: string;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
    }>>(
      Prisma.sql`
        SELECT id, brand_id, name, category, season, style_code, description,
               status, metadata, created_at, updated_at
        FROM garments
        ${whereClause}
        ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `,
    ),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const items = rows.map((g) =>
    toGarmentSummary({
      id: g.id,
      brandId: g.brand_id,
      name: g.name,
      category: g.category,
      season: g.season,
      styleCode: g.style_code,
      description: g.description,
      status: g.status,
      metadata: g.metadata as Prisma.JsonValue,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }),
  );

  return {
    items,
    total,
    page,
    page_size: limit,
    has_next: offset + items.length < total,
  };
}

export async function updateGarment(
  ugi: string,
  brandId: string,
  input: UpdateGarmentInput,
): Promise<GarmentSummary> {
  const existing = await getGarmentByUGI(ugi, brandId);

  const currentGarment = await prisma.garment.findUnique({
    where: { id: existing.id },
  });
  if (!currentGarment) {
    throw new ServiceError("GARMENT_NOT_FOUND", "Garment not found.", 404);
  }

  const meta = getMetadata(currentGarment);

  // Update fabric physics if composition changed
  let fabricPhysics = meta.fabricPhysics;
  if (input.fabricComposition !== undefined) {
    fabricPhysics = input.fabricComposition
      ? deriveFabricPhysics(input.fabricComposition)
      : undefined;
    meta.fabricComposition = input.fabricComposition ?? undefined;
  }
  if (input.fabricPhysics !== undefined) {
    // Allow explicit override
    fabricPhysics = input.fabricPhysics ?? undefined;
  }

  // Update metadata fields
  const updatedMeta: GarmentMetadata = {
    ...meta,
    ...(fabricPhysics !== undefined && { fabricPhysics }),
    ...(input.measurements !== undefined
      ? { measurements: input.measurements }
      : meta.measurements !== undefined
      ? { measurements: meta.measurements }
      : {}),
  };

  // Status mapping
  let prismaStatus = currentGarment.status;
  if (input.status === "archived") prismaStatus = "discontinued" as typeof prismaStatus;
  else if (input.status === "draft") prismaStatus = "draft" as typeof prismaStatus;

  if (input.status === "draft") {
    updatedMeta.publicStatus = "draft";
  } else if (input.status === "archived") {
    updatedMeta.publicStatus = "archived";
  }

  const updated = await prisma.garment.update({
    where: { id: existing.id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.category && { category: input.category }),
      ...(input.season !== undefined && { season: input.season }),
      ...(input.sku !== undefined && { styleCode: input.sku }),
      ...(input.description !== undefined && { description: input.description }),
      status: prismaStatus,
      metadata: updatedMeta as unknown as Prisma.InputJsonValue,
    },
  });

  return toGarmentSummary(updated);
}

export async function deleteGarment(
  ugi: string,
  brandId: string,
): Promise<void> {
  const existing = await getGarmentByUGI(ugi, brandId);

  await prisma.garment.update({
    where: { id: existing.id },
    data: {
      metadata: {
        ...(await prisma.garment
          .findUnique({ where: { id: existing.id } })
          .then((g) => (g?.metadata as Record<string, unknown>) ?? {})),
        publicStatus: "deleted",
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

// ─────────────────────────────────────────────
// File upload & tracking
// ─────────────────────────────────────────────

/**
 * Record that a file was uploaded for a garment.
 * The actual upload goes directly from the browser to S3 via a presigned URL.
 * This endpoint receives notification AFTER the upload completes.
 *
 * Also triggers the 3D pipeline if appropriate for the file type.
 */
export async function recordFileUpload(
  ugi: string,
  brandId: string,
  file: {
    name: string;
    size: number;
    mimeType: string;
    s3Key: string;
    s3Url: string;
  },
): Promise<GarmentSummary> {
  const existing = await getGarmentByUGI(ugi, brandId);

  const garment = await prisma.garment.findUnique({ where: { id: existing.id } });
  if (!garment) throw new ServiceError("GARMENT_NOT_FOUND", "Not found.", 404);

  const meta = getMetadata(garment);
  const assets = meta.assets ?? {};
  const files = assets.files ?? [];

  files.push({
    name: file.name,
    size: file.size,
    type: file.mimeType,
    uploadedAt: new Date().toISOString(),
  });

  // Determine if this file triggers a 3D pipeline
  const is3DAsset = is3DFile(file.name, file.mimeType);
  const isPhotoSet = isImageFile(file.name, file.mimeType);

  // Update asset URL based on file type
  if (is3DAsset && file.name.toLowerCase().endsWith(".glb")) {
    assets.modelUrl = file.s3Url;
  } else if (is3DAsset && file.name.toLowerCase().endsWith(".usdz")) {
    assets.usdzUrl = file.s3Url;
  } else if (isPhotoSet && !assets.thumbnailUrl) {
    assets.thumbnailUrl = file.s3Url;
  }

  // Determine whether to kick off pipeline simulation
  const shouldStartPipeline = is3DAsset || (isPhotoSet && files.length >= 1);
  let pipeline = meta.pipeline ?? { status: "idle", stages: defaultPipelineStages(meta.uploadMethod) };

  if (shouldStartPipeline && pipeline.status === "idle") {
    pipeline = startPipeline(meta.uploadMethod ?? "photos", meta.uploadMethod === "clo3d" ? 120 : 300);
  }

  const updatedMeta: GarmentMetadata = {
    ...meta,
    assets: { ...assets, files },
    pipeline: pipeline as GarmentMetadata["pipeline"],
    ...(shouldStartPipeline
      ? { publicStatus: "processing" }
      : meta.publicStatus !== undefined
      ? { publicStatus: meta.publicStatus }
      : {}),
  };

  const updated = await prisma.garment.update({
    where: { id: existing.id },
    data: {
      status: shouldStartPipeline ? "development" : garment.status,
      metadata: updatedMeta as unknown as Prisma.InputJsonValue,
    },
  });

  return toGarmentSummary(updated);
}

// ─────────────────────────────────────────────
// Scan / Pipeline status
// ─────────────────────────────────────────────

/**
 * Get the 3D scan pipeline status for a garment.
 *
 * Pipeline simulation: since we don't have a real 3D processing backend yet,
 * we simulate progress by advancing stages based on elapsed time since pipeline start.
 * When a real pipeline service is added, this function will poll its status API.
 */
export async function getScanStatus(
  ugi: string,
  brandId: string,
): Promise<ScanStatus> {
  const existing = await getGarmentByUGI(ugi, brandId);

  const garment = await prisma.garment.findUnique({ where: { id: existing.id } });
  if (!garment) throw new ServiceError("GARMENT_NOT_FOUND", "Not found.", 404);

  const meta = getMetadata(garment);
  const pipeline = meta.pipeline ?? { status: "idle", stages: defaultPipelineStages("photos") };

  // Simulate pipeline progress if running
  if (pipeline.status === "running" && pipeline.startedAt) {
    const elapsedSeconds = (Date.now() - new Date(pipeline.startedAt).getTime()) / 1000;
    const totalSeconds = pipeline.estimatedSecondsRemaining ?? 300;
    const stages = simulatePipelineProgress(pipeline.stages, elapsedSeconds, totalSeconds);
    const allComplete = stages.every((s) => s.status === "complete");
    const hasError = stages.some((s) => s.status === "error");

    if (allComplete || hasError) {
      // Pipeline finished — update metadata
      const finalStatus = allComplete ? "complete" : "error";
      const updatedMeta: GarmentMetadata = {
        ...meta,
        pipeline: {
          ...pipeline,
          stages,
          status: finalStatus,
          completedAt: new Date().toISOString(),
          estimatedSecondsRemaining: 0,
        },
        publicStatus: allComplete ? "active" : "error",
        assets: allComplete
          ? {
              ...meta.assets,
              // If no model URL yet (photos path), keep undefined
              modelUrl: meta.assets?.modelUrl,
            }
          : meta.assets,
      };

      await prisma.garment.update({
        where: { id: existing.id },
        data: {
          status: allComplete ? "retail" : "draft",
          metadata: updatedMeta as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        ugi,
        status: allComplete ? "active" : "error",
        stages,
        estimatedSecondsRemaining: 0,
        ...(hasError && { errorMessage: "Processing failed. Please re-upload your files." }),
      };
    }

    // Persist updated progress
    const remaining = Math.max(0, totalSeconds - elapsedSeconds);
    const updatedMeta: GarmentMetadata = {
      ...meta,
      pipeline: {
        ...pipeline,
        stages,
        estimatedSecondsRemaining: Math.round(remaining),
      },
    };
    await prisma.garment.update({
      where: { id: existing.id },
      data: {
        metadata: updatedMeta as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      ugi,
      status: "processing",
      stages,
      estimatedSecondsRemaining: Math.round(remaining),
    };
  }

  return {
    ugi,
    status: existing.status,
    stages: pipeline.stages,
    estimatedSecondsRemaining: pipeline.estimatedSecondsRemaining ?? 0,
  };
}

// ─────────────────────────────────────────────
// Brand stats
// ─────────────────────────────────────────────

export async function getBrandStats(brandId: string): Promise<BrandStats> {
  // Count total garments (not deleted or archived)
  const [totalGarments, allMeta] = await Promise.all([
    prisma.garment.count({
      where: {
        brandId,
        status: { not: "discontinued" },
      },
    }),
    prisma.$queryRaw<Array<{ metadata: unknown; updated_at: Date }>>(
      Prisma.sql`
        SELECT metadata, updated_at
        FROM garments
        WHERE brand_id = ${brandId}
          AND status != 'discontinued'
        ORDER BY updated_at DESC
      `,
    ),
  ]);

  let garmentsWith3D = 0;
  let totalTryOns = 0;
  let lastActivityAt: string | null = null;

  for (const row of allMeta) {
    const meta = row.metadata as GarmentMetadata | null;
    if (meta?.assets?.modelUrl) garmentsWith3D++;
    if (meta?.tryOnCount) totalTryOns += meta.tryOnCount;
  }

  if (allMeta.length > 0) {
    lastActivityAt = allMeta[0]!.updated_at.toISOString();
  }

  return {
    totalGarments,
    garmentsWith3D,
    totalTryOns,
    lastActivityAt,
  };
}

// ─────────────────────────────────────────────
// Pipeline helpers
// ─────────────────────────────────────────────

function defaultPipelineStages(uploadMethod?: string | null): PipelineStage[] {
  if (uploadMethod === "clo3d") {
    return [
      { id: "upload", label: "File uploaded", status: "pending" },
      { id: "parse", label: "Parsing CLO3D project", status: "pending" },
      { id: "model", label: "Extracting 3D model", status: "pending" },
      { id: "physics", label: "Applying fabric physics", status: "pending" },
      { id: "optimise", label: "Optimising for web", status: "pending" },
      { id: "finalise", label: "Finalising", status: "pending" },
    ];
  }

  if (uploadMethod === "pattern") {
    return [
      { id: "upload", label: "Files uploaded", status: "pending" },
      { id: "parse", label: "Parsing patterns", status: "pending" },
      { id: "model", label: "Building 3D model", status: "pending" },
      { id: "physics", label: "Applying fabric physics", status: "pending" },
      { id: "optimise", label: "Optimising for web", status: "pending" },
      { id: "finalise", label: "Finalising", status: "pending" },
    ];
  }

  // Default: photos path
  return [
    { id: "upload", label: "Files uploaded", status: "pending" },
    { id: "analyse", label: "Analysing photos", status: "pending" },
    { id: "model", label: "Building 3D model", status: "pending" },
    { id: "physics", label: "Applying fabric physics", status: "pending" },
    { id: "finalise", label: "Finalising", status: "pending" },
  ];
}

function startPipeline(
  uploadMethod: string,
  totalSeconds: number,
): GarmentMetadata["pipeline"] {
  const stages = defaultPipelineStages(uploadMethod).map((s, i) =>
    i === 0 ? { ...s, status: "complete" as const } : s,
  );

  return {
    stages,
    status: "running",
    startedAt: new Date().toISOString(),
    estimatedSecondsRemaining: totalSeconds,
  };
}

/**
 * Simulates pipeline progress based on elapsed time.
 * Distributes stage completion evenly across total time.
 */
function simulatePipelineProgress(
  stages: PipelineStage[],
  elapsedSeconds: number,
  totalSeconds: number,
): PipelineStage[] {
  if (totalSeconds <= 0) {
    return stages.map((s) => ({ ...s, status: "complete" as const }));
  }

  const progress = Math.min(elapsedSeconds / totalSeconds, 1);
  const stageCount = stages.length;
  const completedUpTo = Math.floor(progress * stageCount);
  const currentStageIndex = completedUpTo;

  return stages.map((stage, i): PipelineStage => {
    if (i < currentStageIndex) {
      return { ...stage, status: "complete" as const, progress: 100 };
    }
    if (i === currentStageIndex && progress < 1) {
      const stageProgress = ((progress * stageCount) - i) * 100;
      const detail = getStageDetail(stage.id, stageProgress);
      return {
        ...stage,
        status: "running" as const,
        progress: Math.round(stageProgress),
        ...(detail !== undefined && { detail }),
      };
    }
    const { progress: _p, detail: _d, ...rest } = stage;
    return { ...rest, status: "pending" as const };
  });
}

function getStageDetail(stageId: string, progress: number): string | undefined {
  if (stageId === "analyse") {
    const total = 12;
    const done = Math.max(1, Math.round((progress / 100) * total));
    return `${done}/${total}`;
  }
  return undefined;
}

function is3DFile(name: string, mimeType: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".glb") ||
    lower.endsWith(".gltf") ||
    lower.endsWith(".usdz") ||
    lower.endsWith(".zprj") ||  // CLO3D project
    lower.endsWith(".dxf") ||   // Pattern file
    lower.endsWith(".ai") ||    // Illustrator pattern
    mimeType === "model/gltf-binary" ||
    mimeType === "model/gltf+json"
  );
}

function isImageFile(name: string, mimeType: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    mimeType.startsWith("image/")
  );
}
