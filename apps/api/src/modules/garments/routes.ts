/**
 * Garments module — API routes.
 *
 * Endpoint map:
 *
 *   GET    /api/v1/garments                         — list brand garments
 *   POST   /api/v1/garments                         — create garment
 *   GET    /api/v1/garments/:ugi                    — get garment by UGI
 *   PATCH  /api/v1/garments/:ugi                    — update garment
 *   DELETE /api/v1/garments/:ugi                    — soft-delete garment
 *   POST   /api/v1/garments/:ugi/files              — notify file upload complete (multipart-safe)
 *   GET    /api/v1/garments/:ugi/scan/status        — 3D pipeline status
 *
 *   GET    /api/v1/brand/stats                      — brand dashboard stats
 *
 *   POST   /api/v1/fabrics/physics                  — derive physics from composition string
 *   POST   /api/v1/scan/label                       — OCR fabric label from image (stub)
 *
 * Auth: all endpoints require a brand-role user. The brand ID is derived
 * from the authenticated user's brand membership. For now we use the first
 * brand the user owns (a brand selector can be added later).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { UserRole } from "@loocbooc/types";
import {
  createGarment,
  getGarmentByUGI,
  listGarments,
  updateGarment,
  deleteGarment,
  recordFileUpload,
  getScanStatus,
  getBrandStats,
  ServiceError,
} from "./service.js";
import { deriveFabricPhysics } from "./fabric-physics.js";
import {
  CreateGarmentSchema,
  UpdateGarmentSchema,
  GarmentFiltersSchema,
  FabricPhysicsQuerySchema,
} from "./schema.js";
import { prisma } from "@loocbooc/database";

// ─────────────────────────────────────────────
// Error handler helper
// ─────────────────────────────────────────────

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof ServiceError) {
    return reply.code(err.statusCode).send({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }
  reply.log.error(err);
  return reply.code(500).send({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
}

// ─────────────────────────────────────────────
// Brand ID resolver
// Resolves the brand ID for the authenticated user.
// Supports both brand owner and brand member access.
// ─────────────────────────────────────────────

async function resolveBrandId(userId: string, userRole: string): Promise<string | null> {
  if (userRole === UserRole.PLATFORM_ADMIN) return null; // Admin bypasses brand scoping

  // Try brand ownership first
  const ownedBrand = await prisma.brand.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  if (ownedBrand) return ownedBrand.id;

  // Try brand membership
  const membership = await prisma.brandMember.findFirst({
    where: { userId },
    select: { brandId: true },
  });
  return membership?.brandId ?? null;
}

// ─────────────────────────────────────────────
// Garment routes
// ─────────────────────────────────────────────

export async function garmentRoutes(app: FastifyInstance): Promise<void> {
  // ── List garments ────────────────────────────────────────────────────────────
  app.get("/", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{
      Querystring: {
        search?: string;
        category?: string;
        status?: string;
        season?: string;
        sortBy?: string;
        sortOrder?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);

      if (!brandId && user.role !== UserRole.PLATFORM_ADMIN) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      const parsed = GarmentFiltersSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Invalid filters.", details: parsed.error.flatten() },
        });
      }

      // Admin can list all garments — for now scope to first brand
      const effectiveBrandId = brandId ?? "";
      const result = await listGarments(effectiveBrandId, parsed.data);
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Create garment ───────────────────────────────────────────────────────────
  app.post("/", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);

      if (!brandId) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      const parsed = CreateGarmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() },
        });
      }

      const garment = await createGarment(brandId, parsed.data);
      return reply.code(201).send(garment);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get garment ──────────────────────────────────────────────────────────────
  app.get("/:ugi", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Params: { ugi: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);
      const isAdmin = user.role === UserRole.PLATFORM_ADMIN;

      if (!brandId && !isAdmin) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      const garment = await getGarmentByUGI(
        request.params.ugi,
        brandId ?? "",
        isAdmin,
      );
      return reply.send(garment);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Update garment ───────────────────────────────────────────────────────────
  app.patch("/:ugi", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Params: { ugi: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);

      if (!brandId) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      const parsed = UpdateGarmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() },
        });
      }

      const garment = await updateGarment(request.params.ugi, brandId, parsed.data);
      return reply.send(garment);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Delete garment ───────────────────────────────────────────────────────────
  app.delete("/:ugi", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Params: { ugi: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);

      if (!brandId) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      await deleteGarment(request.params.ugi, brandId);
      return reply.code(204).send();
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── File upload notification ─────────────────────────────────────────────────
  // Called by the frontend after a successful direct-to-S3 upload.
  // Body can be JSON (from API caller) or multipart/form-data (from wizard).
  // For multipart, we save files to a temp path then record the upload.
  app.post("/:ugi/files", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Params: { ugi: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);

      if (!brandId) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      const contentType = request.headers["content-type"] ?? "";

      if (contentType.includes("multipart/form-data")) {
        // Multipart upload — parse the file metadata from the form
        // In production this would stream to S3. For now we just record the intent.
        const data = request.body as Record<string, unknown> | null;

        // Extract whatever file metadata was sent
        const fileName = (data?.filename as string) ?? (data?.name as string) ?? "upload";
        const fileSize = parseInt(String(data?.size ?? "0"), 10);
        const mimeType = (data?.mimeType as string) ?? (data?.type as string) ?? "application/octet-stream";

        // Generate a placeholder S3 key (in production, upload would have already happened)
        const s3Key = `garments/${request.params.ugi}/${Date.now()}-${fileName}`;
        const s3Url = `https://cdn.loocbooc.com/${s3Key}`;

        const garment = await recordFileUpload(request.params.ugi, brandId, {
          name: fileName,
          size: fileSize,
          mimeType,
          s3Key,
          s3Url,
        });

        return reply.send({ ok: true, garment });
      } else {
        // JSON body with file metadata (post-S3-upload callback)
        const body = request.body as {
          name?: string;
          size?: number;
          mimeType?: string;
          s3Key?: string;
          s3Url?: string;
        } | null;

        if (!body?.name) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "File name is required." },
          });
        }

        const garment = await recordFileUpload(request.params.ugi, brandId, {
          name: body.name,
          size: body.size ?? 0,
          mimeType: body.mimeType ?? "application/octet-stream",
          s3Key: body.s3Key ?? `garments/${request.params.ugi}/${Date.now()}-${body.name}`,
          s3Url: body.s3Url ?? `https://cdn.loocbooc.com/garments/${request.params.ugi}/${body.name}`,
        });

        return reply.send({ ok: true, garment });
      }
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Scan / pipeline status ───────────────────────────────────────────────────
  app.get("/:ugi/scan/status", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Params: { ugi: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);
      const isAdmin = user.role === UserRole.PLATFORM_ADMIN;

      if (!brandId && !isAdmin) {
        return reply.code(403).send({
          error: { code: "NO_BRAND_ACCESS", message: "No brand associated with this account." },
        });
      }

      const status = await getScanStatus(request.params.ugi, brandId ?? "");
      return reply.send(status);
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

// ─────────────────────────────────────────────
// Brand stats route
// ─────────────────────────────────────────────

export async function brandStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stats", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user!;
      const brandId = await resolveBrandId(user.id, user.role);

      if (!brandId) {
        // Return zero stats for accounts not yet linked to a brand
        return reply.send({
          totalGarments: 0,
          garmentsWith3D: 0,
          totalTryOns: 0,
          lastActivityAt: null,
        });
      }

      const stats = await getBrandStats(brandId);
      return reply.send(stats);
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

// ─────────────────────────────────────────────
// Fabric physics route
// ─────────────────────────────────────────────

export async function fabricRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/fabrics/physics
   * Body: { composition: string }
   * Returns: { drape, stretch, weight, breathability, sheen }
   *
   * Used by the upload wizard to populate fabric sliders from a
   * hand-typed composition string.
   */
  app.post("/physics", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = FabricPhysicsQuerySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "composition string is required." },
        });
      }

      const physics = deriveFabricPhysics(parsed.data.composition);
      return reply.send(physics);
    } catch (err) {
      reply.log.error(err);
      return reply.code(500).send({
        error: { code: "INTERNAL_ERROR", message: "Failed to derive fabric physics." },
      });
    }
  });
}

// ─────────────────────────────────────────────
// Scan / OCR label route
// ─────────────────────────────────────────────

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/scan/label
   * Body: multipart/form-data with image file
   * Returns: { composition: string }
   *
   * In production this calls an OCR/CV service (e.g. AWS Textract or a
   * fine-tuned CV model). For now returns a placeholder response that will
   * be replaced once the ML service is integrated.
   *
   * The frontend wizard uses this to auto-fill the composition field
   * when a user photographs a care label.
   */
  app.post("/label", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO: Extract image from multipart, send to ML service for OCR
      // For now: return a stub that tells the frontend OCR is not yet available
      // The frontend falls back to manual entry gracefully.
      return reply.code(501).send({
        error: {
          code: "OCR_NOT_AVAILABLE",
          message: "Fabric label OCR is not yet enabled on this instance.",
        },
      });
    } catch (err) {
      reply.log.error(err);
      return reply.code(500).send({
        error: { code: "INTERNAL_ERROR", message: "Label scan failed." },
      });
    }
  });
}
