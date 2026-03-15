/**
 * Universal Avatar module — API routes.
 *
 * Endpoint map:
 *
 *   GET    /api/v1/avatars                        — list my avatars
 *   POST   /api/v1/avatars                        — create avatar
 *   GET    /api/v1/avatars/:avatarId              — get full avatar
 *   PATCH  /api/v1/avatars/:avatarId              — update avatar
 *   DELETE /api/v1/avatars/:avatarId              — delete avatar
 *   GET    /api/v1/avatars/:avatarId/fit          — get fit recommendation
 *   GET    /api/v1/avatars/:avatarId/taste        — get taste profile snapshot
 *   POST   /api/v1/avatars/taste-signal           — record a taste signal (fire-and-forget)
 *
 *   POST   /api/v1/size-charts                    — create size chart (brand only)
 *   GET    /api/v1/size-charts?brandId=           — list brand's size charts
 *
 * All routes require auth. Avatars are always scoped to the requesting user.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../auth/guards.js";
import {
  createAvatar,
  getAvatar,
  getUserAvatars,
  updateAvatar,
  deleteAvatar,
  getFitRecommendation,
  createSizeChart,
  getBrandSizeCharts,
  recordTasteSignal,
  getAvatarTasteProfile,
  ServiceError,
} from "./service.js";
import {
  CreateAvatarSchema,
  UpdateAvatarSchema,
  GetFitRecommendationSchema,
  SizeChartSchema,
  RecordTasteSignalSchema,
  avatarBodyJsonSchema,
} from "./schema.js";

function handleServiceError(err: unknown, reply: FastifyReply) {
  if (err instanceof ServiceError) {
    return reply.code(err.statusCode).send({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }
  reply.log.error(err);
  return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
}

export async function avatarRoutes(app: FastifyInstance): Promise<void> {
  // ── List my avatars ──────────────────────────────────────────────────────────
  app.get("/", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const avatars = await getUserAvatars(userId);
      return reply.send({ avatars });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Create avatar ────────────────────────────────────────────────────────────
  app.post("/", {
    preHandler: [requireAuth],
    schema: { body: avatarBodyJsonSchema },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const parsed = CreateAvatarSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const avatar = await createAvatar(userId, parsed.data);
      return reply.code(201).send({ avatar });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Get avatar ───────────────────────────────────────────────────────────────
  app.get("/:avatarId", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest<{ Params: { avatarId: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const isAdmin = request.user!.role === "admin";
      const avatar = await getAvatar(request.params.avatarId, userId, isAdmin);
      return reply.send({ avatar });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Update avatar ────────────────────────────────────────────────────────────
  app.patch("/:avatarId", {
    preHandler: [requireAuth],
    schema: { body: avatarBodyJsonSchema },
  }, async (request: FastifyRequest<{ Params: { avatarId: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const parsed = UpdateAvatarSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const avatar = await updateAvatar(request.params.avatarId, userId, parsed.data);
      return reply.send({ avatar });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Delete avatar ────────────────────────────────────────────────────────────
  app.delete("/:avatarId", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest<{ Params: { avatarId: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      await deleteAvatar(request.params.avatarId, userId);
      return reply.code(204).send();
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Fit recommendation ───────────────────────────────────────────────────────
  app.get("/:avatarId/fit", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Params: { avatarId: string }; Querystring: { skuId?: string; sizeChartId?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const userId = request.user!.id;
      const parsed = GetFitRecommendationSchema.safeParse({
        avatarId: request.params.avatarId,
        skuId: request.query.skuId,
        sizeChartId: request.query.sizeChartId,
      });
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "avatarId and skuId are required.", details: parsed.error.flatten() } });
      }
      const recommendation = await getFitRecommendation(userId, parsed.data);
      return reply.send({ recommendation });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Taste profile ────────────────────────────────────────────────────────────
  app.get("/:avatarId/taste", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest<{ Params: { avatarId: string } }>, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const profile = await getAvatarTasteProfile(request.params.avatarId, userId);
      return reply.send({ tasteProfile: profile });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  // ── Record taste signal ──────────────────────────────────────────────────────
  app.post("/taste-signal", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const parsed = RecordTasteSignalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid signal.", details: parsed.error.flatten() } });
      }
      // Fire and forget — don't await
      void recordTasteSignal({ userId, ...parsed.data });
      return reply.code(202).send({ ok: true });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });
}

// ─────────────────────────────────────────────
// Size chart routes (brand-facing)
// ─────────────────────────────────────────────

export async function sizeChartRoutes(app: FastifyInstance): Promise<void> {
  // Create size chart — brand only
  app.post("/", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const role = request.user?.role;
      if (role !== "brand_owner" && role !== "brand_member" && role !== "admin") {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Brand access required." } });
      }
      const parsed = SizeChartSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid size chart.", details: parsed.error.flatten() } });
      }
      const chart = await createSizeChart(parsed.data);
      return reply.code(201).send({ chart });
    } catch (err) {
      if (err instanceof ServiceError) {
        return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      reply.log.error(err);
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to create size chart." } });
    }
  });

  // List size charts for a brand
  app.get("/", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest<{ Querystring: { brandId?: string } }>, reply: FastifyReply) => {
    try {
      const brandId = request.query.brandId;
      if (!brandId) {
        return reply.code(400).send({ error: { code: "MISSING_BRAND_ID", message: "brandId query param is required." } });
      }
      const charts = await getBrandSizeCharts(brandId);
      return reply.send({ charts });
    } catch (err) {
      reply.log.error(err);
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch size charts." } });
    }
  });
}
