/**
 * Universal Avatar module — Service layer.
 *
 * All business logic lives here. Routes are thin wrappers.
 *
 * Key design decisions:
 * - One user can have multiple avatars (shopping for different bodies, kids etc)
 * - isPrimary is enforced to have exactly one per user (atomic swap on set)
 * - Body shape is computed server-side on every save — never trust client input
 * - Fit recommendations are cached in avatar_fit_results — not recomputed on every request
 * - Taste signals are fire-and-forget (enqueued) — never block API response
 */

import { prisma, Prisma } from "@loocbooc/database";
import { enqueueTasteEngineJob } from "../../lib/queues.js";
import {
  recommendFit,
  calculateBodyShape,
  computeCompletionPercent,
  getConfidenceLabel,
} from "./fit-engine.js";
import type {
  AvatarSummary,
  AvatarFull,
  AvatarMeasurements,
  FitRecommendationResult,
  StoredSizeChart,
  TasteSignalInput,
  FitResultSummary,
} from "./types.js";
import type {
  CreateAvatarInput,
  UpdateAvatarInput,
  GetFitRecommendationInput,
  CreateSizeChartInput,
} from "./schema.js";

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
// Avatar CRUD
// ─────────────────────────────────────────────

/**
 * Create a new avatar for a user.
 * If this is the user's first avatar, isPrimary = true automatically.
 * Body shape is computed server-side from measurements.
 */
export async function createAvatar(
  userId: string,
  input: CreateAvatarInput,
): Promise<AvatarSummary> {
  // Check if this is the first avatar for this user
  const existingCount = await prisma.avatar.count({ where: { userId } });
  const isPrimary = existingCount === 0;

  // Compute body shape server-side from provided measurements
  const measurements: AvatarMeasurements = {
    height: input.height ?? null,
    weightKg: input.weightKg ?? null,
    bust: input.bust ?? null,
    chest: input.chest ?? null,
    waist: input.waist ?? null,
    hips: input.hips ?? null,
    inseam: input.inseam ?? null,
    shoulderWidth: input.shoulderWidth ?? null,
    sleeveLength: input.sleeveLength ?? null,
    neck: input.neck ?? null,
    thigh: input.thigh ?? null,
    rise: input.rise ?? null,
  };

  const bodyShapeResult = calculateBodyShape(measurements);
  const bodyShape = input.bodyShape ?? (bodyShapeResult.shape !== "unknown" ? bodyShapeResult.shape : null);

  // Compute confidence from completeness
  const completionPercent = computeCompletionPercent(measurements);
  const confidenceScore =
    bodyShapeResult.shape !== "unknown"
      ? new Prisma.Decimal(Math.min(bodyShapeResult.confidence * (completionPercent / 100) + 0.1, 1).toFixed(2))
      : null;

  const avatar = await prisma.avatar.create({
    data: {
      userId,
      nickname: input.nickname ?? null,
      height: input.height ? new Prisma.Decimal(input.height) : null,
      weightKg: input.weightKg ? new Prisma.Decimal(input.weightKg) : null,
      bust: input.bust ? new Prisma.Decimal(input.bust) : null,
      chest: input.chest ? new Prisma.Decimal(input.chest) : null,
      waist: input.waist ? new Prisma.Decimal(input.waist) : null,
      hips: input.hips ? new Prisma.Decimal(input.hips) : null,
      inseam: input.inseam ? new Prisma.Decimal(input.inseam) : null,
      shoulderWidth: input.shoulderWidth ? new Prisma.Decimal(input.shoulderWidth) : null,
      sleeveLength: input.sleeveLength ? new Prisma.Decimal(input.sleeveLength) : null,
      neck: input.neck ? new Prisma.Decimal(input.neck) : null,
      thigh: input.thigh ? new Prisma.Decimal(input.thigh) : null,
      rise: input.rise ? new Prisma.Decimal(input.rise) : null,
      bodyShape,
      fitPreference: input.fitPreference ?? null,
      measurementMethod: input.measurementMethod ?? null,
      confidenceScore,
      isPrimary,
    },
  });

  // Enqueue taste engine processing — avatar creation is the initial onboarding signal
  void enqueueTasteEngineJob(userId);

  return toAvatarSummary(avatar, completionPercent, 0);
}

/**
 * Get a single avatar by ID (must belong to the requesting user unless admin).
 */
export async function getAvatar(
  avatarId: string,
  userId: string,
  isAdmin = false,
): Promise<AvatarFull> {
  const avatar = await prisma.avatar.findUnique({
    where: { id: avatarId },
    include: {
      fitResults: {
        include: {
          sku: {
            include: {
              garment: {
                include: { brand: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!avatar) {
    throw new ServiceError("AVATAR_NOT_FOUND", "Avatar not found.", 404);
  }

  if (!isAdmin && avatar.userId !== userId) {
    throw new ServiceError("FORBIDDEN", "You do not have access to this avatar.", 403);
  }

  const measurements: AvatarMeasurements = extractMeasurements(avatar);
  const completionPercent = computeCompletionPercent(measurements);

  const fitResults: FitResultSummary[] = avatar.fitResults.map((fr) => {
    const fitScore = fr.fitScore ? Number(fr.fitScore) : null;
    return {
      skuId: fr.skuId,
      garmentName: fr.sku.garment.name,
      brandName: fr.sku.garment.brand.name,
      recommendedSize: fr.recommendedSize,
      fitScore,
      fitLabel: fitScore === null ? null :
        fitScore >= 0.9 ? "perfect" :
        fitScore >= 0.75 ? "good" :
        fitScore >= 0.55 ? "ok" : "poor",
      renderUrl: fr.renderUrl,
      createdAt: fr.createdAt.toISOString(),
    };
  });

  const summary = toAvatarSummary(avatar, completionPercent, fitResults.length);

  return {
    ...summary,
    measurements,
    fitResults,
    tasteProfile: null, // Taste Engine will populate this in a future session
  };
}

/**
 * List all avatars for a user.
 */
export async function getUserAvatars(userId: string): Promise<AvatarSummary[]> {
  const avatars = await prisma.avatar.findMany({
    where: { userId },
    include: {
      _count: { select: { fitResults: true } },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  return avatars.map((a) => {
    const measurements = extractMeasurements(a);
    const completionPercent = computeCompletionPercent(measurements);
    return toAvatarSummary(a, completionPercent, a._count.fitResults);
  });
}

/**
 * Update an avatar's measurements or preferences.
 * Body shape is recomputed server-side on every update.
 */
export async function updateAvatar(
  avatarId: string,
  userId: string,
  input: UpdateAvatarInput,
): Promise<AvatarSummary> {
  const existing = await prisma.avatar.findUnique({ where: { id: avatarId } });
  if (!existing) throw new ServiceError("AVATAR_NOT_FOUND", "Avatar not found.", 404);
  if (existing.userId !== userId) throw new ServiceError("FORBIDDEN", "Not your avatar.", 403);

  // Build updated measurements for body shape recomputation
  const currentMeasurements = extractMeasurements(existing);
  const updatedMeasurements: AvatarMeasurements = {
    height:         toNum(input.height) ?? currentMeasurements.height,
    weightKg:       toNum(input.weightKg) ?? currentMeasurements.weightKg,
    bust:           toNum(input.bust) ?? currentMeasurements.bust,
    chest:          toNum(input.chest) ?? currentMeasurements.chest,
    waist:          toNum(input.waist) ?? currentMeasurements.waist,
    hips:           toNum(input.hips) ?? currentMeasurements.hips,
    inseam:         toNum(input.inseam) ?? currentMeasurements.inseam,
    shoulderWidth:  toNum(input.shoulderWidth) ?? currentMeasurements.shoulderWidth,
    sleeveLength:   toNum(input.sleeveLength) ?? currentMeasurements.sleeveLength,
    neck:           toNum(input.neck) ?? currentMeasurements.neck,
    thigh:          toNum(input.thigh) ?? currentMeasurements.thigh,
    rise:           toNum(input.rise) ?? currentMeasurements.rise,
  };

  const bodyShapeResult = calculateBodyShape(updatedMeasurements);
  const bodyShape = input.bodyShape ?? (bodyShapeResult.shape !== "unknown" ? bodyShapeResult.shape : existing.bodyShape);
  const completionPercent = computeCompletionPercent(updatedMeasurements);
  const confidenceScore =
    bodyShapeResult.shape !== "unknown"
      ? new Prisma.Decimal(Math.min(bodyShapeResult.confidence * (completionPercent / 100) + 0.1, 1).toFixed(2))
      : existing.confidenceScore;

  // Handle isPrimary swap atomically
  const setPrimary = input.isPrimary === true;
  let updated;

  if (setPrimary && !existing.isPrimary) {
    // Unset primary on all other avatars, then set this one
    updated = await prisma.$transaction(async (tx) => {
      await tx.avatar.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.avatar.update({
        where: { id: avatarId },
        data: {
          ...buildUpdateData(input),
          bodyShape,
          confidenceScore,
          isPrimary: true,
        },
      });
    });
  } else {
    updated = await prisma.avatar.update({
      where: { id: avatarId },
      data: {
        ...buildUpdateData(input),
        bodyShape,
        confidenceScore,
      },
    });
  }

  return toAvatarSummary(updated, completionPercent, 0);
}

/**
 * Delete an avatar. If it was the primary, promote the oldest remaining.
 */
export async function deleteAvatar(avatarId: string, userId: string): Promise<void> {
  const existing = await prisma.avatar.findUnique({ where: { id: avatarId } });
  if (!existing) throw new ServiceError("AVATAR_NOT_FOUND", "Avatar not found.", 404);
  if (existing.userId !== userId) throw new ServiceError("FORBIDDEN", "Not your avatar.", 403);

  await prisma.$transaction(async (tx) => {
    await tx.avatarFitResult.deleteMany({ where: { avatarId } });
    await tx.avatar.delete({ where: { id: avatarId } });

    // If this was primary, promote the oldest remaining avatar
    if (existing.isPrimary) {
      const oldest = await tx.avatar.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      if (oldest) {
        await tx.avatar.update({ where: { id: oldest.id }, data: { isPrimary: true } });
      }
    }
  });
}

// ─────────────────────────────────────────────
// Fit recommendation
// ─────────────────────────────────────────────

/**
 * Generate a fit recommendation for an avatar + SKU combination.
 * Checks for a cached result first; if stale or missing, recomputes.
 * Persists result to avatar_fit_results.
 */
export async function getFitRecommendation(
  userId: string,
  input: GetFitRecommendationInput,
): Promise<FitRecommendationResult> {
  const { avatarId, skuId } = input;

  // Verify avatar ownership
  const avatar = await prisma.avatar.findUnique({ where: { id: avatarId } });
  if (!avatar) throw new ServiceError("AVATAR_NOT_FOUND", "Avatar not found.", 404);
  if (avatar.userId !== userId) throw new ServiceError("FORBIDDEN", "Not your avatar.", 403);

  // Check for a recent cached result (< 7 days old)
  const cached = await prisma.avatarFitResult.findUnique({
    where: { avatarId_skuId: { avatarId, skuId } },
  });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (cached && cached.createdAt > sevenDaysAgo && cached.fitNotes) {
    // Return cached result
    const fitNotes = cached.fitNotes as Record<string, unknown>;
    return {
      avatarId,
      skuId,
      recommendedSize: cached.recommendedSize ?? "M",
      alternativeSize: (fitNotes?.alternativeSize as string) ?? null,
      fitScore: Number(cached.fitScore ?? 0),
      fitLabel: (fitNotes?.fitLabel as "perfect" | "good" | "ok" | "poor") ?? "ok",
      confidence: (fitNotes?.confidence as number) ?? 0.5,
      measurementGaps: (fitNotes?.measurementGaps as string[]) ?? [],
      sizeBreakdown: [],
      message: (fitNotes?.message as string) ?? "",
    };
  }

  // Load size chart
  let sizeChartData;
  if (input.sizeChartId) {
    sizeChartData = await getSizeChartById(input.sizeChartId);
    if (!sizeChartData) throw new ServiceError("SIZE_CHART_NOT_FOUND", "Size chart not found.", 404);
  } else if (input.sizeChart) {
    sizeChartData = input.sizeChart;
  } else {
    // No size chart provided — generate a default one based on the SKU's garment category
    const sku = await prisma.sKU.findUnique({
      where: { id: skuId },
      include: { garment: { select: { category: true, brandId: true } } },
    });
    if (!sku) throw new ServiceError("SKU_NOT_FOUND", "SKU not found.", 404);

    // Try to find any size chart for this brand/category
    const brandChart = await prisma.sizeChart.findFirst({
      where: {
        brandId: sku.garment.brandId,
        ...(sku.garment.category ? { category: sku.garment.category } : {}),
      },
    });

    if (brandChart) {
      sizeChartData = {
        brand: "",
        category: brandChart.category,
        sizeSystem: brandChart.sizeSystem,
        rows: brandChart.rows as unknown as import("./types.js").SizeChartRow[],
      };
    } else {
      // Fall back to a generic AU women's size chart
      sizeChartData = getDefaultSizeChart(sku.garment.category ?? "dress");
    }
  }

  const measurements = extractMeasurements(avatar);
  const result = recommendFit(measurements, sizeChartData, avatar.fitPreference ?? "regular");
  result.avatarId = avatarId;
  result.skuId = skuId;

  // Persist/update fit result
  const fitNotesPayload = {
    fitLabel: result.fitLabel,
    alternativeSize: result.alternativeSize,
    confidence: result.confidence,
    measurementGaps: result.measurementGaps,
    message: result.message,
    sizeBreakdown: result.sizeBreakdown,
  } as unknown as Prisma.InputJsonValue;

  await prisma.avatarFitResult.upsert({
    where: { avatarId_skuId: { avatarId, skuId } },
    create: {
      avatarId,
      skuId,
      fitScore: new Prisma.Decimal(result.fitScore.toFixed(2)),
      recommendedSize: result.recommendedSize,
      fitNotes: fitNotesPayload,
    },
    update: {
      fitScore: new Prisma.Decimal(result.fitScore.toFixed(2)),
      recommendedSize: result.recommendedSize,
      fitNotes: fitNotesPayload,
    },
  });

  // Fire taste signal — backing with size selection is a strong signal
  void recordTasteSignal({
    userId,
    avatarId,
    signalType: "size_selected",
    entityId: skuId,
    entityType: "sku",
    payload: {
      recommendedSize: result.recommendedSize,
      fitScore: result.fitScore,
      category: sizeChartData.category,
    },
  });

  return result;
}

// ─────────────────────────────────────────────
// Size chart management
// ─────────────────────────────────────────────

export async function createSizeChart(input: CreateSizeChartInput): Promise<StoredSizeChart> {
  const chart = await prisma.sizeChart.create({
    data: {
      brandId: input.brandId,
      garmentId: input.garmentId ?? null,
      name: input.name,
      category: input.category,
      sizeSystem: input.sizeSystem,
      rows: input.rows as Prisma.InputJsonValue,
    },
  });

  return {
    id: chart.id,
    brandId: chart.brandId,
    garmentId: chart.garmentId,
    name: chart.name,
    category: chart.category,
    sizeSystem: chart.sizeSystem,
    rows: chart.rows as unknown as import("./types.js").SizeChartRow[],
    createdAt: chart.createdAt.toISOString(),
  };
}

export async function deleteSizeChart(chartId: string): Promise<void> {
  const existing = await prisma.sizeChart.findUnique({ where: { id: chartId } });
  if (!existing) {
    throw new ServiceError("SIZE_CHART_NOT_FOUND", "Size chart not found.", 404);
  }
  await prisma.sizeChart.delete({ where: { id: chartId } });
}

export async function getBrandSizeCharts(brandId: string): Promise<StoredSizeChart[]> {
  const charts = await prisma.sizeChart.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });

  return charts.map((c) => ({
    id: c.id,
    brandId: c.brandId,
    garmentId: c.garmentId,
    name: c.name,
    category: c.category,
    sizeSystem: c.sizeSystem,
    rows: c.rows as unknown as import("./types.js").SizeChartRow[],
    createdAt: c.createdAt.toISOString(),
  }));
}

async function getSizeChartById(chartId: string) {
  const chart = await prisma.sizeChart.findUnique({ where: { id: chartId } });
  if (!chart) return null;
  return {
    brand: "",
    category: chart.category,
    sizeSystem: chart.sizeSystem,
    rows: chart.rows as unknown as import("./types.js").SizeChartRow[],
  };
}

// ─────────────────────────────────────────────
// Taste signal recording
// ─────────────────────────────────────────────

/**
 * Record a taste signal. Fire-and-forget — writes to DB immediately,
 * then enqueues the Taste Engine for deferred aggregation.
 *
 * Called from: avatar fit recommendation, Back It campaign backing, browse events.
 *
 * The taste engine job is debounced per-user with a 5-minute delay:
 * rapid browsing → 1 aggregation job, not dozens.
 */
export async function recordTasteSignal(input: TasteSignalInput): Promise<void> {
  // Write signal immediately — always sync, never lose a signal
  await prisma.tasteSignal.create({
    data: {
      userId: input.userId,
      avatarId: input.avatarId ?? null,
      signalType: input.signalType,
      entityId: input.entityId ?? null,
      entityType: input.entityType ?? null,
      payload: (input.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      sessionId: input.sessionId ?? null,
    },
  });

  // Enqueue the Taste Engine to process this user's signals (debounced)
  void enqueueTasteEngineJob(input.userId);
}

/**
 * Get taste signal summary for an avatar (used in profile display).
 */
export async function getAvatarTasteProfile(avatarId: string, userId: string) {
  const avatar = await prisma.avatar.findUnique({ where: { id: avatarId } });
  if (!avatar || avatar.userId !== userId) {
    throw new ServiceError("FORBIDDEN", "Not your avatar.", 403);
  }

  const signals = await prisma.tasteSignal.findMany({
    where: { avatarId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const categories: Record<string, number> = {};
  const sizes: Record<string, number> = {};

  for (const signal of signals) {
    const payload = signal.payload as Record<string, unknown> | null;
    if (signal.signalType === "size_selected" && payload?.recommendedSize) {
      const size = payload.recommendedSize as string;
      sizes[size] = (sizes[size] ?? 0) + 1;
    }
    if (payload?.category && typeof payload.category === "string") {
      categories[payload.category] = (categories[payload.category] ?? 0) + 1;
    }
  }

  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  const topSizes = Object.entries(sizes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([size]) => size);

  return {
    totalSignals: signals.length,
    topCategories,
    topSizes,
    lastUpdated: signals[0]?.createdAt.toISOString() ?? null,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

type AvatarRecord = {
  id: string;
  userId: string;
  nickname: string | null;
  isPrimary: boolean;
  measurementMethod: string | null;
  confidenceScore: Prisma.Decimal | null;
  bodyShape: string | null;
  fitPreference: string | null;
  avatarImgUrl: string | null;
  avatar3dUrl: string | null;
  sizeAu: string | null;
  sizeUs: string | null;
  sizeEu: string | null;
  createdAt: Date;
  updatedAt: Date;
  height: Prisma.Decimal | null;
  weightKg: Prisma.Decimal | null;
  bust: Prisma.Decimal | null;
  chest: Prisma.Decimal | null;
  waist: Prisma.Decimal | null;
  hips: Prisma.Decimal | null;
  inseam: Prisma.Decimal | null;
  shoulderWidth: Prisma.Decimal | null;
  sleeveLength: Prisma.Decimal | null;
  neck: Prisma.Decimal | null;
  thigh: Prisma.Decimal | null;
  rise: Prisma.Decimal | null;
};

function toAvatarSummary(
  avatar: AvatarRecord,
  completionPercent: number,
  fitResultCount: number,
): AvatarSummary {
  const confidenceNum = avatar.confidenceScore ? Number(avatar.confidenceScore) : null;
  return {
    id: avatar.id,
    userId: avatar.userId,
    nickname: avatar.nickname,
    isPrimary: avatar.isPrimary,
    measurementMethod: avatar.measurementMethod,
    confidenceScore: confidenceNum,
    confidenceLabel: getConfidenceLabel(confidenceNum, completionPercent),
    bodyShape: avatar.bodyShape,
    fitPreference: avatar.fitPreference,
    avatarImgUrl: avatar.avatarImgUrl,
    avatar3dUrl: avatar.avatar3dUrl,
    sizeAu: avatar.sizeAu,
    sizeUs: avatar.sizeUs,
    sizeEu: avatar.sizeEu,
    createdAt: avatar.createdAt.toISOString(),
    updatedAt: avatar.updatedAt.toISOString(),
    completionPercent,
    hasFitHistory: fitResultCount > 0,
  };
}

function extractMeasurements(avatar: AvatarRecord): AvatarMeasurements {
  return {
    height:        avatar.height ? Number(avatar.height) : null,
    weightKg:      avatar.weightKg ? Number(avatar.weightKg) : null,
    bust:          avatar.bust ? Number(avatar.bust) : null,
    chest:         avatar.chest ? Number(avatar.chest) : null,
    waist:         avatar.waist ? Number(avatar.waist) : null,
    hips:          avatar.hips ? Number(avatar.hips) : null,
    inseam:        avatar.inseam ? Number(avatar.inseam) : null,
    shoulderWidth: avatar.shoulderWidth ? Number(avatar.shoulderWidth) : null,
    sleeveLength:  avatar.sleeveLength ? Number(avatar.sleeveLength) : null,
    neck:          avatar.neck ? Number(avatar.neck) : null,
    thigh:         avatar.thigh ? Number(avatar.thigh) : null,
    rise:          avatar.rise ? Number(avatar.rise) : null,
  };
}

function toNum(val: number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  return val;
}

function buildUpdateData(input: UpdateAvatarInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.nickname !== undefined) data["nickname"] = input.nickname;
  if (input.height !== undefined) data["height"] = input.height ? new Prisma.Decimal(input.height) : null;
  if (input.weightKg !== undefined) data["weightKg"] = input.weightKg ? new Prisma.Decimal(input.weightKg) : null;
  if (input.bust !== undefined) data["bust"] = input.bust ? new Prisma.Decimal(input.bust) : null;
  if (input.chest !== undefined) data["chest"] = input.chest ? new Prisma.Decimal(input.chest) : null;
  if (input.waist !== undefined) data["waist"] = input.waist ? new Prisma.Decimal(input.waist) : null;
  if (input.hips !== undefined) data["hips"] = input.hips ? new Prisma.Decimal(input.hips) : null;
  if (input.inseam !== undefined) data["inseam"] = input.inseam ? new Prisma.Decimal(input.inseam) : null;
  if (input.shoulderWidth !== undefined) data["shoulderWidth"] = input.shoulderWidth ? new Prisma.Decimal(input.shoulderWidth) : null;
  if (input.sleeveLength !== undefined) data["sleeveLength"] = input.sleeveLength ? new Prisma.Decimal(input.sleeveLength) : null;
  if (input.neck !== undefined) data["neck"] = input.neck ? new Prisma.Decimal(input.neck) : null;
  if (input.thigh !== undefined) data["thigh"] = input.thigh ? new Prisma.Decimal(input.thigh) : null;
  if (input.rise !== undefined) data["rise"] = input.rise ? new Prisma.Decimal(input.rise) : null;
  if (input.fitPreference !== undefined) data["fitPreference"] = input.fitPreference;
  if (input.measurementMethod !== undefined) data["measurementMethod"] = input.measurementMethod;
  if (input.sizeAu !== undefined) data["sizeAu"] = input.sizeAu;
  if (input.sizeUs !== undefined) data["sizeUs"] = input.sizeUs;
  if (input.sizeEu !== undefined) data["sizeEu"] = input.sizeEu;
  return data;
}

// ─────────────────────────────────────────────
// Default size chart (fallback for brands without a custom chart)
// Based on Australian standard sizing
// ─────────────────────────────────────────────

function getDefaultSizeChart(category: string): import("./types.js").SizeChartData {
  const isBottom = ["trouser", "pant", "skirt", "short"].some((c) =>
    category.toLowerCase().includes(c)
  );

  if (isBottom) {
    return {
      brand: "Default AU",
      category,
      sizeSystem: "AU",
      rows: [
        { size: "6",  waistMin: 60, waistMax: 65,  hipsMin: 85,  hipsMax: 90  },
        { size: "8",  waistMin: 65, waistMax: 70,  hipsMin: 90,  hipsMax: 95  },
        { size: "10", waistMin: 70, waistMax: 75,  hipsMin: 95,  hipsMax: 100 },
        { size: "12", waistMin: 75, waistMax: 82,  hipsMin: 100, hipsMax: 107 },
        { size: "14", waistMin: 82, waistMax: 89,  hipsMin: 107, hipsMax: 114 },
        { size: "16", waistMin: 89, waistMax: 97,  hipsMin: 114, hipsMax: 122 },
        { size: "18", waistMin: 97, waistMax: 105, hipsMin: 122, hipsMax: 130 },
        { size: "20", waistMin: 105, waistMax: 115, hipsMin: 130, hipsMax: 140 },
      ],
    };
  }

  // Default: top / dress
  return {
    brand: "Default AU",
    category,
    sizeSystem: "AU",
    rows: [
      { size: "6",  bustMin: 78,  bustMax: 83,  waistMin: 60, waistMax: 65,  hipsMin: 85,  hipsMax: 90  },
      { size: "8",  bustMin: 83,  bustMax: 88,  waistMin: 65, waistMax: 70,  hipsMin: 90,  hipsMax: 95  },
      { size: "10", bustMin: 88,  bustMax: 93,  waistMin: 70, waistMax: 75,  hipsMin: 95,  hipsMax: 100 },
      { size: "12", bustMin: 93,  bustMax: 100, waistMin: 75, waistMax: 82,  hipsMin: 100, hipsMax: 107 },
      { size: "14", bustMin: 100, bustMax: 107, waistMin: 82, waistMax: 89,  hipsMin: 107, hipsMax: 114 },
      { size: "16", bustMin: 107, bustMax: 114, waistMin: 89, waistMax: 97,  hipsMin: 114, hipsMax: 122 },
      { size: "18", bustMin: 114, bustMax: 122, waistMin: 97, waistMax: 105, hipsMin: 122, hipsMax: 130 },
      { size: "20", bustMin: 122, bustMax: 132, waistMin: 105, waistMax: 115, hipsMin: 130, hipsMax: 140 },
    ],
  };
}
