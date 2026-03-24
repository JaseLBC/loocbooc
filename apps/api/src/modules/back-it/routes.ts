/**
 * Back It API routes — all campaign and backing endpoints.
 * Route handlers are thin: validate input, call service, return response.
 *
 * Authentication:
 *   All brand-scoped and consumer-action routes require authentication via
 *   the requireAuth preHandler. Public read endpoints (GET campaign, size breaks)
 *   are intentionally open.
 *
 * Brand ownership:
 *   The client provides brandId in the request body for campaign creation.
 *   The service validates the requesting user is a member of that brand.
 *   This avoids storing brandId in the JWT (which would break multi-brand support).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CampaignParamsSchema,
  BrandCampaignsParamsSchema,
  BrandCampaignsQuerySchema,
  PlaceBackingSchema,
  CreatePaymentIntentSchema,
  ConfirmBackingSchema,
} from "./schema.js";
import {
  createCampaign,
  getCampaign,
  updateCampaign,
  cancelCampaign,
  listBrandCampaigns,
  getCampaignSizeBreaks,
  placeBacking,
  checkAndTriggerMoq,
  listCampaignBackings,
  publishCampaign,
  markCampaignInProduction,
  markCampaignShipped,
  markCampaignCompleted,
  createPaymentIntentForBacking,
  confirmBacking,
  browseCampaigns,
  getCampaignBySlug,
  getConsumerBackings,
  ServiceError,
} from "./service.js";
import { requireAuth } from "../auth/guards.js";
import { z } from "zod";

// ─── Error handler ────────────────────────────────────────────────────────────

/**
 * Maps service errors to typed API responses.
 * Converts ServiceError instances to structured 4xx responses.
 * All other errors become 500s.
 */
function handleError(err: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ServiceError) {
    return reply.status(err.statusCode).send({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: request.id,
      },
    });
  }
  request.log.error(err, "Unhandled error in Back It route");
  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: request.id,
    },
  });
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function backItRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/v1/back-it/campaigns ──────────────────────────────────────────
  // Create a new campaign. The requesting user must be a member of the brand.
  // brandId is required in the body so multi-brand accounts work correctly.
  app.post("/back-it/campaigns", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;

      // Extend schema to require brandId for campaign ownership validation
      const body = CreateCampaignSchema.extend({
        brandId: z.string().uuid(),
      }).parse(request.body);

      const { brandId, ...campaignInput } = body;

      const campaign = await createCampaign(brandId, userId, campaignInput);
      return reply.status(201).send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/back-it/campaigns/:id ───────────────────────────────────────
  // Get a single campaign by ID. Public — no auth required.
  app.get("/back-it/campaigns/:id", async (request, reply) => {
    try {
      const { id } = CampaignParamsSchema.parse(request.params);
      const campaign = await getCampaign(id);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── PATCH /api/v1/back-it/campaigns/:id ─────────────────────────────────────
  // Update a campaign (draft/scheduled only). Brand member access verified in service.
  app.patch("/back-it/campaigns/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const body = UpdateCampaignSchema.parse(request.body);

      const campaign = await updateCampaign(id, userId, body);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/back ─────────────────────────────────
  // Place a backing on a campaign. Requires authentication (consumer or brand).
  app.post("/back-it/campaigns/:id/back", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const body = PlaceBackingSchema.parse(request.body);

      const result = await placeBacking(id, userId, body);

      return reply.status(201).send({
        data: {
          backing: result.backing,
          moqJustReached: result.moqJustReached,
        },
      });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/back-it/campaigns/:id/size-breaks ───────────────────────────
  // Get current size distribution for a campaign. Public — no auth required.
  app.get("/back-it/campaigns/:id/size-breaks", async (request, reply) => {
    try {
      const { id } = CampaignParamsSchema.parse(request.params);
      const sizeBreaks = await getCampaignSizeBreaks(id);
      return reply.send({ data: sizeBreaks });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/cancel ───────────────────────────────
  // Cancel a campaign (pre-MOQ only). Brand member access verified in service.
  // Expects { brandId } in request body for ownership verification.
  app.post("/back-it/campaigns/:id/cancel", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const { brandId } = z.object({ brandId: z.string().uuid() }).parse(request.body);

      const campaign = await cancelCampaign(id, brandId, userId);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/back-it/brands/:brandId/campaigns ───────────────────────────
  // List all campaigns for a brand. Brand membership is verified via auth guard.
  app.get("/back-it/brands/:brandId/campaigns", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { brandId } = BrandCampaignsParamsSchema.parse(request.params);
      const query = BrandCampaignsQuerySchema.parse(request.query);

      const result = await listBrandCampaigns(brandId, query);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/back-it/campaigns/:id/backings ──────────────────────────────
  // List backings for a campaign. Brand members only (verified in service).
  app.get("/back-it/campaigns/:id/backings", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const query = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }).parse(request.query);

      const result = await listCampaignBackings(id, userId, query.page, query.limit);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/publish ───────────────────────────────
  // Publish a draft/scheduled campaign. Brand member access verified in service.
  app.post("/back-it/campaigns/:id/publish", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const campaign = await publishCampaign(id, userId);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/mark-in-production ────────────────────
  app.post("/back-it/campaigns/:id/mark-in-production", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const campaign = await markCampaignInProduction(id, userId);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/mark-shipped ─────────────────────────
  app.post("/back-it/campaigns/:id/mark-shipped", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const campaign = await markCampaignShipped(id, userId);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/mark-completed ───────────────────────
  app.post("/back-it/campaigns/:id/mark-completed", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = CampaignParamsSchema.parse(request.params);
      const campaign = await markCampaignCompleted(id, userId);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/back-it/campaigns/:id/create-payment-intent ────────────────
  // Step 1 of 2-step Stripe flow.
  // Consumer submits size + shipping address → server creates a PaymentIntent
  // (not yet confirmed) and returns the client_secret for mounting
  // the Stripe Payment Element in the browser.
  app.post(
    "/back-it/campaigns/:id/create-payment-intent",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = CampaignParamsSchema.parse(request.params);
        const body = CreatePaymentIntentSchema.parse(request.body);

        const result = await createPaymentIntentForBacking(id, userId, body);
        return reply.status(201).send({ data: result });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── POST /api/v1/back-it/campaigns/:id/confirm-backing ───────────────────────
  // Step 2 of 2-step Stripe flow.
  // Called by the success page after Stripe redirects back with a confirmed
  // PaymentIntent. Creates the backing record in the DB and triggers MOQ check.
  // Idempotent: safe to call multiple times for the same paymentIntentId.
  app.post(
    "/back-it/campaigns/:id/confirm-backing",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id } = CampaignParamsSchema.parse(request.params);
        const body = ConfirmBackingSchema.parse(request.body);

        const result = await confirmBacking(id, userId, body);
        return reply.status(result.alreadyConfirmed ? 200 : 201).send({
          data: {
            backing: result.backing,
            moqJustReached: result.moqJustReached,
            alreadyConfirmed: result.alreadyConfirmed ?? false,
          },
        });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── GET /api/v1/campaigns ────────────────────────────────────────────────────
  // Public consumer-facing campaign browse and search.
  // Called by the Explore page (/explore) for discovery.
  // No auth required — publicly browseable.
  //
  // Query params:
  //   status   — campaign status (default: "active")
  //   category — garment category filter (e.g. "dress", "top")
  //   search   — text search on title/description
  //   sort     — "newest" | "ending_soon" | "most_backed" | "percent_funded"
  //   limit    — page size (max 50, default 24)
  //   offset   — pagination offset (default 0)
  app.get("/campaigns", async (request, reply) => {
    try {
      const querySchema = z.object({
        status:   z.string().optional(),
        category: z.string().optional(),
        search:   z.string().max(200).optional(),
        sort: z
          .enum(["newest", "ending_soon", "most_backed", "percent_funded"])
          .optional()
          .default("newest"),
        limit:  z.coerce.number().int().min(1).max(50).default(24),
        offset: z.coerce.number().int().min(0).default(0),
      });

      const raw = querySchema.parse(request.query);
      const result = await browseCampaigns({
        status:   raw.status,
        category: raw.category,
        search:   raw.search,
        sort:     raw.sort,
        limit:    raw.limit,
        offset:   raw.offset,
      });
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/campaigns/slug/:slug ─────────────────────────────────────────
  // Get a single campaign by its public slug.
  // Used by the consumer campaign page when loaded from a slug URL
  // (e.g. /back/my-campaign-slug → fetches /api/v1/campaigns/slug/my-campaign-slug).
  // Also used by the Shopify theme extension widget.
  // No auth required — all non-draft campaigns are publicly visible.
  app.get("/campaigns/slug/:slug", async (request, reply) => {
    try {
      const { slug } = z
        .object({ slug: z.string().min(1).max(150) })
        .parse(request.params);

      const campaign = await getCampaignBySlug(slug);
      return reply.send({ data: campaign });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/users/me/backings ────────────────────────────────────────────
  // Return the authenticated consumer's backing history.
  // Ordered by most recent first. Includes campaign context for each backing.
  //
  // Query params:
  //   limit  — page size (max 50, default 20)
  //   offset — pagination offset (default 0)
  app.get("/users/me/backings", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const query = z.object({
        limit:  z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(request.query);

      const result = await getConsumerBackings(userId, query.limit, query.offset);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/internal/campaigns/check-moq ───────────────────────────────
  // Internal safety-net: checks all campaigns for missed MOQ triggers.
  // Secured by internal API key header — NOT user JWT.
  // Called by the worker's cron job every 15 minutes as a fallback.
  app.post("/internal/campaigns/check-moq", {
    onRequest: async (request, reply) => {
      const apiKey = request.headers["x-internal-api-key"];
      if (apiKey !== process.env["INTERNAL_API_KEY"]) {
        return reply.status(401).send({
          error: { code: "UNAUTHORIZED", message: "Invalid API key.", requestId: request.id },
        });
      }
    },
  }, async (request, reply) => {
    try {
      const { prisma } = await import("@loocbooc/database");

      // Find campaigns that may have crossed MOQ but weren't triggered
      const candidates = await prisma.campaign.findMany({
        where: { status: "active", moqReached: false },
        select: { id: true, currentBackingCount: true, moq: true },
      });

      const toCheck = candidates.filter((c) => c.currentBackingCount >= c.moq);

      const results = await Promise.allSettled(
        toCheck.map((c) => checkAndTriggerMoq(c.id)),
      );

      const triggered = results.filter(
        (r) => r.status === "fulfilled" && !r.value.alreadyTriggered && r.value.moqReached,
      ).length;

      return reply.send({ data: { checked: toCheck.length, triggered } });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });
}
