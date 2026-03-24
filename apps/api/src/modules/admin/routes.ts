/**
 * Admin Routes — PLATFORM_ADMIN access only.
 *
 * All routes are gated by requirePlatformAdmin.
 * These routes expose full platform visibility and administrative actions.
 *
 * GET    /api/v1/admin/stats                     — platform overview stats
 * GET    /api/v1/admin/activity                  — recent platform activity feed
 * GET    /api/v1/admin/campaigns                 — list all campaigns (filterable)
 * PATCH  /api/v1/admin/campaigns/:id/flag        — flag/unflag a campaign
 * PATCH  /api/v1/admin/campaigns/:id/force-expire — force expire a campaign
 * GET    /api/v1/admin/manufacturers/pending     — manufacturers awaiting verification
 * PATCH  /api/v1/admin/manufacturers/:id/approve — approve manufacturer verification
 * PATCH  /api/v1/admin/manufacturers/:id/reject  — reject manufacturer verification
 * GET    /api/v1/admin/users                     — list users (filterable)
 * PATCH  /api/v1/admin/users/:id/suspend         — suspend/unsuspend a user
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requirePlatformAdmin } from "../auth/guards.js";
import * as adminService from "./service.js";

// ─────────────────────────────────────────────
// Request type helpers
// ─────────────────────────────────────────────

interface CampaignListQuery {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
  flaggedOnly?: string;
}

interface UserListQuery {
  page?: string;
  limit?: string;
  role?: string;
  search?: string;
}

interface FlagBody {
  flagged: boolean;
  reason?: string;
}

interface RejectBody {
  reason: string;
}

interface SuspendBody {
  suspended: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function ok(reply: FastifyReply, data: unknown) {
  return reply.send({ data });
}

function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: { code: "VALIDATION_ERROR", message },
  });
}

function notFound(reply: FastifyReply, message: string) {
  return reply.status(404).send({
    error: { code: "NOT_FOUND", message },
  });
}

function parsePage(raw: string | undefined, fallback = 1): number {
  const n = parseInt(raw ?? String(fallback));
  return isNaN(n) || n < 1 ? fallback : n;
}

function parseLimit(raw: string | undefined, max = 100, fallback = 25): number {
  const n = parseInt(raw ?? String(fallback));
  if (isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

// ─────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require auth + platform admin role
  const guard = { preHandler: [requireAuth, requirePlatformAdmin] };

  // ─── GET /api/v1/admin/stats ────────────────

  fastify.get("/stats", guard, async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await adminService.getPlatformStats();
      return ok(reply, stats);
    } catch (err) {
      fastify.log.error(err, "Admin stats fetch failed");
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch stats" } });
    }
  });

  // ─── GET /api/v1/admin/activity ─────────────

  fastify.get<{ Querystring: { limit?: string } }>(
    "/activity",
    guard,
    async (request, reply) => {
      const limit = parseLimit(request.query.limit, 50, 20);
      try {
        const activity = await adminService.getRecentActivity(limit);
        return ok(reply, activity);
      } catch (err) {
        fastify.log.error(err, "Admin activity fetch failed");
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch activity" } });
      }
    },
  );

  // ─── GET /api/v1/admin/campaigns ────────────

  fastify.get<{ Querystring: CampaignListQuery }>(
    "/campaigns",
    guard,
    async (request, reply) => {
      const q = request.query;
      const page = parsePage(q.page);
      const limit = parseLimit(q.limit);

      try {
        const result = await adminService.listCampaignsAdmin({
          page,
          limit,
          ...(q.status ? { status: q.status } : {}),
          ...(q.search ? { search: q.search } : {}),
          flaggedOnly: q.flaggedOnly === "true",
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err, "Admin campaigns list failed");
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to list campaigns" } });
      }
    },
  );

  // ─── PATCH /api/v1/admin/campaigns/:id/flag ─

  fastify.patch<{ Params: { id: string }; Body: FlagBody }>(
    "/campaigns/:id/flag",
    guard,
    async (request, reply) => {
      const { id } = request.params;
      const { flagged, reason } = request.body ?? {};

      if (typeof flagged !== "boolean") {
        return badRequest(reply, "flagged (boolean) is required.");
      }

      try {
        await adminService.adminFlagCampaign(id, flagged, reason ?? null);
        return ok(reply, { updated: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to update campaign" } });
      }
    },
  );

  // ─── PATCH /api/v1/admin/campaigns/:id/force-expire

  fastify.patch<{ Params: { id: string } }>(
    "/campaigns/:id/force-expire",
    guard,
    async (request, reply) => {
      const { id } = request.params;
      try {
        await adminService.adminForceExpireCampaign(id);
        return ok(reply, { updated: true });
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error && err.message === "Campaign not found") {
          return notFound(reply, "Campaign not found.");
        }
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to expire campaign" } });
      }
    },
  );

  // ─── GET /api/v1/admin/manufacturers/pending ─

  fastify.get(
    "/manufacturers/pending",
    guard,
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const pending = await adminService.listPendingManufacturers();
        return ok(reply, pending);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch pending manufacturers" } });
      }
    },
  );

  // ─── PATCH /api/v1/admin/manufacturers/:id/approve

  fastify.patch<{ Params: { id: string } }>(
    "/manufacturers/:id/approve",
    guard,
    async (request, reply) => {
      const { id } = request.params;
      try {
        await adminService.approveManufacturer(id);
        return ok(reply, { approved: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to approve manufacturer" } });
      }
    },
  );

  // ─── PATCH /api/v1/admin/manufacturers/:id/reject

  fastify.patch<{ Params: { id: string }; Body: RejectBody }>(
    "/manufacturers/:id/reject",
    guard,
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body ?? {};

      if (!reason || typeof reason !== "string") {
        return badRequest(reply, "reason is required.");
      }

      try {
        await adminService.rejectManufacturer(id, reason);
        return ok(reply, { rejected: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to reject manufacturer" } });
      }
    },
  );

  // ─── GET /api/v1/admin/users ────────────────

  fastify.get<{ Querystring: UserListQuery }>(
    "/users",
    guard,
    async (request, reply) => {
      const q = request.query;
      const page = parsePage(q.page);
      const limit = parseLimit(q.limit);

      try {
        const result = await adminService.listUsersAdmin({
          page,
          limit,
          ...(q.role ? { role: q.role } : {}),
          ...(q.search ? { search: q.search } : {}),
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to list users" } });
      }
    },
  );

  // ─── PATCH /api/v1/admin/users/:id/suspend ──

  fastify.patch<{ Params: { id: string }; Body: SuspendBody }>(
    "/users/:id/suspend",
    guard,
    async (request, reply) => {
      const { id } = request.params;
      const { suspended } = request.body ?? {};

      if (typeof suspended !== "boolean") {
        return badRequest(reply, "suspended (boolean) is required.");
      }

      try {
        await adminService.suspendUser(id, suspended);
        return ok(reply, { updated: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Failed to update user" } });
      }
    },
  );
}
