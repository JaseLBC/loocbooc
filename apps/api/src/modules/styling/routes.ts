/**
 * Styling Marketplace — API routes.
 *
 * Endpoint map:
 *
 * === STYLIST DISCOVERY (public) ===
 *   GET    /api/v1/stylists                        — search stylists
 *   GET    /api/v1/stylists/:idOrSlug              — get stylist profile
 *
 * === STYLIST MANAGEMENT (authenticated stylist) ===
 *   POST   /api/v1/stylists                        — create/register as stylist
 *   GET    /api/v1/stylists/me                     — get my stylist profile
 *   PATCH  /api/v1/stylists/:id                    — update stylist profile
 *   POST   /api/v1/stylists/:id/portfolio          — add portfolio image
 *   DELETE /api/v1/stylists/:id/portfolio/:itemId  — remove portfolio image
 *   POST   /api/v1/stylists/:id/rate               — rate a stylist (consumer)
 *
 * === BRIEF — CONSUMER ===
 *   POST   /api/v1/briefs                          — submit a style brief
 *   GET    /api/v1/briefs                          — my briefs
 *   GET    /api/v1/briefs/:id                      — get brief detail
 *   PATCH  /api/v1/briefs/:id                      — update brief
 *   DELETE /api/v1/briefs/:id                      — close/cancel brief
 *   POST   /api/v1/briefs/:id/accept               — accept lookbook
 *
 * === BRIEF — STYLIST ===
 *   GET    /api/v1/briefs/feed                     — open brief feed (PII-stripped)
 *   GET    /api/v1/briefs/mine                     — my stylist briefs
 *   POST   /api/v1/briefs/:id/accept-as-stylist    — stylist accepts a brief
 *   POST   /api/v1/briefs/:id/start-work           — mark in-progress
 *
 * === LOOKBOOK — STYLIST ===
 *   GET    /api/v1/briefs/:briefId/lookbook        — get lookbook
 *   PATCH  /api/v1/briefs/:briefId/lookbook        — update lookbook metadata
 *   POST   /api/v1/briefs/:briefId/lookbook/publish — publish to consumer
 *   POST   /api/v1/briefs/:briefId/lookbook/items  — add item
 *   PATCH  /api/v1/briefs/:briefId/lookbook/items/:itemId — update item
 *   DELETE /api/v1/briefs/:briefId/lookbook/items/:itemId — remove item
 *
 * === COMMISSIONS — STYLIST ===
 *   GET    /api/v1/stylists/me/commissions         — commission summary
 *
 * === ADMIN ===
 *   POST   /api/v1/admin/stylists/:id/verify       — verify a stylist
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { UserRole } from "@loocbooc/types";
import {
  createStylist,
  updateStylist,
  getStylist,
  getMyStylistProfile,
  searchStylists,
  addPortfolioItem,
  deletePortfolioItem,
  rateStylist,
  verifyStylist,
  createBrief,
  updateBrief,
  closeBrief,
  acceptLookbook,
  getMyBriefs,
  getBrief,
  getOpenBriefs,
  acceptBrief,
  startWorkOnBrief,
  getMyStylistBriefs,
  getLookbook,
  updateLookbook,
  addLookbookItem,
  updateLookbookItem,
  removeLookbookItem,
  publishLookbook,
  getStylistCommissions,
  StylingError,
} from "./service.js";
import {
  CreateStylistSchema,
  UpdateStylistSchema,
  AddPortfolioItemSchema,
  RateStylistSchema,
  CreateBriefSchema,
  UpdateBriefSchema,
  AddLookbookItemSchema,
  UpdateLookbookItemSchema,
  UpdateLookbookSchema,
  StylistSearchSchema,
} from "./schema.js";

// ─────────────────────────────────────────────
// Error handler helper
// ─────────────────────────────────────────────

function handleError(err: unknown, reply: FastifyReply): ReturnType<typeof reply.send> {
  if (err instanceof StylingError) {
    return reply.code(err.statusCode).send({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }
  reply.log.error(err);
  return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
}

// ─────────────────────────────────────────────
// Stylist routes
// ─────────────────────────────────────────────

export async function stylistRoutes(app: FastifyInstance): Promise<void> {

  // ── Search stylists (public) ─────────────────────────────────────────────
  app.get<{
    Querystring: {
      search?: string;
      specialisation?: string;
      limit?: string;
      offset?: string;
      onlyAvailable?: string;
      onlyVerified?: string;
      maxBudgetCents?: string;
    };
  }>("/", async (request, reply) => {
    try {
      const parsed = StylistSearchSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters.", details: parsed.error.flatten() } });
      }
      const result = await searchStylists(parsed.data);
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get my stylist profile ──────────────────────────────────────────────
  app.get("/me", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const profile = await getMyStylistProfile(request.user!.id);
      if (!profile) {
        return reply.code(404).send({ error: { code: "NOT_A_STYLIST", message: "You do not have a stylist profile." } });
      }
      return reply.send({ stylist: profile });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get my commissions ──────────────────────────────────────────────────
  app.get("/me/commissions", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const commissions = await getStylistCommissions(request.user!.id);
      return reply.send({ commissions });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Register as stylist ─────────────────────────────────────────────────
  app.post("/", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = CreateStylistSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const stylist = await createStylist(request.user!.id, parsed.data);
      return reply.code(201).send({ stylist });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get stylist by id or slug (public) ──────────────────────────────────
  app.get<{ Params: { idOrSlug: string } }>("/:idOrSlug", async (request, reply) => {
    try {
      const stylist = await getStylist(request.params.idOrSlug);
      return reply.send({ stylist });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Update stylist profile ──────────────────────────────────────────────
  app.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = UpdateStylistSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const isAdmin = request.user!.role === UserRole.PLATFORM_ADMIN;
      const stylist = await updateStylist(request.params.id, request.user!.id, parsed.data, isAdmin);
      return reply.send({ stylist });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Add portfolio item ──────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>("/:id/portfolio", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = AddPortfolioItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const item = await addPortfolioItem(request.params.id, request.user!.id, parsed.data);
      return reply.code(201).send({ item });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Remove portfolio item ───────────────────────────────────────────────
  app.delete<{ Params: { id: string; itemId: string } }>("/:id/portfolio/:itemId", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      await deletePortfolioItem(request.params.itemId, request.user!.id);
      return reply.code(204).send();
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Rate a stylist ──────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>("/:id/rate", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = RateStylistSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      await rateStylist(request.params.id, request.user!.id, parsed.data);
      return reply.code(202).send({ ok: true });
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

// ─────────────────────────────────────────────
// Brief routes
// ─────────────────────────────────────────────

export async function briefRoutes(app: FastifyInstance): Promise<void> {

  // ── Brief feed for stylists ─────────────────────────────────────────────
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/feed", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      // Any authenticated user can see the feed — they need a stylist profile to accept
      const stylistProfile = await getMyStylistProfile(request.user!.id);
      if (!stylistProfile) {
        return reply.code(403).send({ error: { code: "NOT_A_STYLIST", message: "Stylist profile required." } });
      }
      const limit = Math.min(parseInt(request.query.limit ?? "20", 10), 50);
      const offset = parseInt(request.query.offset ?? "0", 10);
      const result = await getOpenBriefs(stylistProfile.id, { limit, offset });
      return reply.send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── My stylist briefs ───────────────────────────────────────────────────
  app.get<{ Querystring: { limit?: string; offset?: string; status?: string } }>("/mine", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const briefs = await getMyStylistBriefs(request.user!.id, {
        limit: parseInt(request.query.limit ?? "20", 10),
        offset: parseInt(request.query.offset ?? "0", 10),
        status: request.query.status,
      });
      return reply.send({ briefs });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Submit a brief (consumer) ───────────────────────────────────────────
  app.post("/", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = CreateBriefSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const brief = await createBrief(request.user!.id, parsed.data);
      return reply.code(201).send({ brief });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── My briefs (consumer) ────────────────────────────────────────────────
  app.get<{ Querystring: { limit?: string; offset?: string; status?: string } }>("/", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const briefs = await getMyBriefs(request.user!.id, {
        limit: parseInt(request.query.limit ?? "20", 10),
        offset: parseInt(request.query.offset ?? "0", 10),
        status: request.query.status,
      });
      return reply.send({ briefs });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get brief detail ────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/:id", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const brief = await getBrief(request.params.id, request.user!.id);
      return reply.send({ brief });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Update brief ────────────────────────────────────────────────────────
  app.patch<{ Params: { id: string } }>("/:id", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = UpdateBriefSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const brief = await updateBrief(request.params.id, request.user!.id, parsed.data);
      return reply.send({ brief });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Close/cancel brief (consumer) ──────────────────────────────────────
  app.delete<{ Params: { id: string } }>("/:id", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      await closeBrief(request.params.id, request.user!.id);
      return reply.code(204).send();
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Accept lookbook (consumer) ──────────────────────────────────────────
  app.post<{ Params: { id: string } }>("/:id/accept", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const brief = await acceptLookbook(request.params.id, request.user!.id);
      return reply.send({ brief });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Stylist accepts a brief ─────────────────────────────────────────────
  app.post<{ Params: { id: string } }>("/:id/accept-as-stylist", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const brief = await acceptBrief(request.params.id, request.user!.id);
      return reply.send({ brief });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Start work on brief (stylist) ──────────────────────────────────────
  app.post<{ Params: { id: string } }>("/:id/start-work", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      await startWorkOnBrief(request.params.id, request.user!.id);
      return reply.code(202).send({ ok: true });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get lookbook ────────────────────────────────────────────────────────
  app.get<{ Params: { briefId: string } }>("/:briefId/lookbook", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const lookbook = await getLookbook(request.params.briefId, request.user!.id);
      return reply.send({ lookbook });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Update lookbook metadata ────────────────────────────────────────────
  app.patch<{ Params: { briefId: string } }>("/:briefId/lookbook", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = UpdateLookbookSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const lookbook = await updateLookbook(request.params.briefId, request.user!.id, parsed.data);
      return reply.send({ lookbook });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Publish lookbook ────────────────────────────────────────────────────
  app.post<{ Params: { briefId: string } }>("/:briefId/lookbook/publish", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const lookbook = await publishLookbook(request.params.briefId, request.user!.id);
      return reply.send({ lookbook });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Add lookbook item ───────────────────────────────────────────────────
  app.post<{ Params: { briefId: string } }>("/:briefId/lookbook/items", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = AddLookbookItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const item = await addLookbookItem(request.params.briefId, request.user!.id, parsed.data);
      return reply.code(201).send({ item });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Update lookbook item ────────────────────────────────────────────────
  app.patch<{ Params: { briefId: string; itemId: string } }>("/:briefId/lookbook/items/:itemId", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const parsed = UpdateLookbookItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: parsed.error.flatten() } });
      }
      const item = await updateLookbookItem(request.params.itemId, request.user!.id, parsed.data);
      return reply.send({ item });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Remove lookbook item ────────────────────────────────────────────────
  app.delete<{ Params: { briefId: string; itemId: string } }>("/:briefId/lookbook/items/:itemId", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      await removeLookbookItem(request.params.itemId, request.user!.id);
      return reply.code(204).send();
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

// ─────────────────────────────────────────────
// Admin verify route (used by admin module)
// ─────────────────────────────────────────────

export async function adminVerifyStylist(stylistId: string): ReturnType<typeof verifyStylist> {
  return verifyStylist(stylistId);
}
