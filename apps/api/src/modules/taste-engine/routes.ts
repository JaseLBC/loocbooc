/**
 * Taste Engine API routes.
 *
 * Endpoint map:
 *
 *   GET    /api/v1/taste/profile                  — get my taste profile (preference model)
 *   GET    /api/v1/taste/campaigns                — personalised campaign recommendations
 *   POST   /api/v1/taste/feedback                 — record RLHF feedback on a recommendation
 *   POST   /api/v1/taste/rebuild                  — force-rebuild my taste profile
 *
 * All routes require auth.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../auth/guards.js";
import {
  getTasteProfile,
  getPersonalisedCampaigns,
  recordRLHFFeedback,
  forceRebuildProfile,
  getUserSignalCount,
} from "./service.js";

function handleError(err: unknown, reply: FastifyReply) {
  reply.log.error(err);
  return reply.code(500).send({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
}

export async function tasteEngineRoutes(app: FastifyInstance): Promise<void> {

  // ── Get taste profile ────────────────────────────────────────────────────
  // Returns the synthesised preference model for the current user.
  // Returns null if not enough signals yet, with a 202 status.
  app.get("/profile", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const [profile, signalCount] = await Promise.all([
        getTasteProfile(userId),
        getUserSignalCount(userId),
      ]);

      if (!profile) {
        return reply.code(202).send({
          profile: null,
          signalCount,
          message: "Your taste profile is being built. Check back in a few minutes.",
          ready: false,
        });
      }

      return reply.send({
        profile,
        signalCount,
        ready: true,
      });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Personalised campaign feed ───────────────────────────────────────────
  // Returns active campaigns sorted by relevance to the user's taste profile.
  app.get("/campaigns", {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const userId = request.user!.id;
      const limit = Math.min(parseInt(request.query.limit ?? "20", 10), 50);
      const offset = parseInt(request.query.offset ?? "0", 10);

      const result = await getPersonalisedCampaigns(userId, limit, offset);
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Record RLHF feedback ─────────────────────────────────────────────────
  // Called when the user explicitly thumbs up/down a recommendation,
  // or when they purchase an item that was recommended.
  app.post("/feedback", {
    preHandler: [requireAuth],
    schema: {
      body: {
        type: "object",
        required: ["entityId", "entityType", "feedback"],
        properties: {
          entityId:         { type: "string" },
          entityType:       { type: "string", enum: ["sku", "campaign", "style_brief"] },
          feedback:         { type: "string", enum: ["thumbs_up", "thumbs_down", "purchased", "ignored", "saved"] },
          context:          { type: "string", maxLength: 100 },
          recommendationId: { type: "string" },
          payload:          { type: "object" },
        },
        additionalProperties: false,
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: {
        entityId: string;
        entityType: string;
        feedback: string;
        context?: string;
        recommendationId?: string;
        payload?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const userId = request.user!.id;
      await recordRLHFFeedback(userId, request.body);
      // Acknowledged — fire-and-forget on taste engine
      return reply.code(202).send({ ok: true });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Force rebuild ────────────────────────────────────────────────────────
  // Triggers an immediate full rebuild of the user's taste profile.
  // Useful after completing the style quiz or adding measurements.
  app.post("/rebuild", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      await forceRebuildProfile(userId);
      return reply.code(202).send({
        ok: true,
        message: "Profile rebuild queued. Ready in ~30 seconds.",
      });
    } catch (err) {
      return handleError(err, reply);
    }
  });
}
