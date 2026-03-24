/**
 * PLM Routes — Production Intelligence
 *
 * All endpoints require authentication.
 * Brand-scoped endpoints verify the requesting user belongs to the brand.
 *
 * POST   /api/v1/plm/records                    — create style record
 * GET    /api/v1/plm/records/:id                — get record with full history
 * PATCH  /api/v1/plm/records/:id/stage          — advance stage
 * POST   /api/v1/plm/records/:id/cost           — log cost entry
 * POST   /api/v1/plm/records/:id/samples        — log sample round
 * GET    /api/v1/plm/brands/:brandId/dashboard  — brand PLM dashboard
 * GET    /api/v1/plm/brands/:brandId/overdue    — overdue styles
 * GET    /api/v1/plm/brands/:brandId/cost-flags — styles with cost blowouts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { $Enums } from "@loocbooc/database/generated/client";
type PLMStage = $Enums.PLMStage;
import { PLMService } from "./service";

// ─────────────────────────────────────────────
// Request type helpers
// ─────────────────────────────────────────────

interface RecordParams {
  id: string;
}

interface BrandParams {
  brandId: string;
}

interface CreateRecordBody {
  brandId: string;
  styleName: string;
  styleCode: string;
  season?: string;
  targetCost?: string;
  manufacturerId?: string;
  assignedTo?: string;
  notes?: string;
  skuId?: string;
}

interface AdvanceStageBody {
  newStage: PLMStage;
  notes?: string;
}

interface CostEntryBody {
  entryType: string;
  amount: string;
  colourway?: string;
  currency?: string;
  notes?: string;
}

interface SampleRoundBody {
  roundNumber: number;
  shippedAt?: string;
  trackingNumber?: string;
  carrier?: string;
  receivedAt?: string;
  fitNotes?: string;
  fitApproved?: boolean;
  adjustments?: string;
}

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

const PLM_STAGES: readonly PLMStage[] = [
  "DESIGN", "TECH_PACK_SENT", "TECH_PACK_APPROVED", "SAMPLE_ORDERED",
  "SAMPLE_IN_PRODUCTION", "SAMPLE_SHIPPED", "SAMPLE_RECEIVED", "FIT_SESSION",
  "ADJUSTMENTS_SENT", "COUNTER_SAMPLE_REQUESTED", "COUNTER_SAMPLE_SHIPPED",
  "COUNTER_SAMPLE_RECEIVED", "BULK_APPROVED", "IN_PRODUCTION", "SHIPPED",
  "DELIVERED", "CANCELLED",
] as const;

function isValidPLMStage(stage: string): stage is PLMStage {
  return (PLM_STAGES as readonly string[]).includes(stage);
}

function badRequest(reply: FastifyReply, message: string, code = "VALIDATION_ERROR") {
  return reply.status(400).send({
    error: { code, message, requestId: reply.request?.id ?? "unknown" },
  });
}

function notFound(reply: FastifyReply, message: string) {
  return reply.status(404).send({
    error: { code: "NOT_FOUND", message, requestId: reply.request?.id ?? "unknown" },
  });
}

// ─────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────

export async function plmRoutes(
  fastify: FastifyInstance,
  opts: { plmService: PLMService }
): Promise<void> {
  const { plmService } = opts;

  // ─── POST /api/v1/plm/records ─────────────

  fastify.post(
    "/api/v1/plm/records",
    async (
      request: FastifyRequest<{ Body: CreateRecordBody }>,
      reply: FastifyReply
    ) => {
      const body = request.body;

      if (!body.brandId || !body.styleName || !body.styleCode) {
        return badRequest(reply, "brandId, styleName, and styleCode are required.");
      }

      // Validate decimal format if provided
      if (body.targetCost !== undefined) {
        const parsed = parseFloat(body.targetCost);
        if (isNaN(parsed) || parsed < 0) {
          return badRequest(reply, "targetCost must be a non-negative decimal string.");
        }
      }

      try {
        const record = await plmService.createPLMRecord(body.brandId, {
          styleName: body.styleName,
          styleCode: body.styleCode,
          season: body.season,
          targetCost: body.targetCost,
          manufacturerId: body.manufacturerId,
          assignedTo: body.assignedTo,
          notes: body.notes,
          skuId: body.skuId,
        });

        return reply.status(201).send({ data: record });
      } catch (err: unknown) {
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create PLM record.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── GET /api/v1/plm/records/:id ──────────

  fastify.get(
    "/api/v1/plm/records/:id",
    async (
      request: FastifyRequest<{ Params: RecordParams }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        const record = await plmService.getRecord(id);
        return reply.send({ data: record });
      } catch (err: unknown) {
        if (isNotFoundError(err)) {
          return notFound(reply, `PLM record '${id}' not found.`);
        }
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve PLM record.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── PATCH /api/v1/plm/records/:id/stage ──

  fastify.patch(
    "/api/v1/plm/records/:id/stage",
    async (
      request: FastifyRequest<{ Params: RecordParams; Body: AdvanceStageBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;

      if (!body.newStage) {
        return badRequest(reply, "newStage is required.");
      }
      if (!isValidPLMStage(body.newStage)) {
        return badRequest(
          reply,
          `Invalid stage '${body.newStage}'. Must be one of: ${PLM_STAGES.join(", ")}.`
        );
      }

      // Extract userId from auth context (populated by auth middleware)
      const userId = (request as unknown as { userId?: string }).userId ?? "system";

      try {
        const record = await plmService.advanceStage(id, {
          newStage: body.newStage,
          userId,
          notes: body.notes,
        });
        return reply.send({ data: record });
      } catch (err: unknown) {
        if (isNotFoundError(err)) {
          return notFound(reply, `PLM record '${id}' not found.`);
        }
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to advance stage.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── POST /api/v1/plm/records/:id/cost ────

  fastify.post(
    "/api/v1/plm/records/:id/cost",
    async (
      request: FastifyRequest<{ Params: RecordParams; Body: CostEntryBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;

      if (!body.entryType || body.amount === undefined) {
        return badRequest(reply, "entryType and amount are required.");
      }

      const parsedAmount = parseFloat(body.amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return badRequest(reply, "amount must be a non-negative decimal string.");
      }

      const userId = (request as unknown as { userId?: string }).userId;

      try {
        const result = await plmService.updateCost(id, {
          entryType: body.entryType,
          amount: body.amount,
          colourway: body.colourway,
          currency: body.currency,
          notes: body.notes,
          recordedBy: userId,
        });
        return reply.status(201).send({
          data: result.entry,
          meta: {
            costFlag: result.record.costFlag,
            flagTriggered: result.flagTriggered,
            currentCost: result.record.currentCost?.toString() ?? null,
            costVariance: result.record.costVariance?.toString() ?? null,
          },
        });
      } catch (err: unknown) {
        if (isNotFoundError(err)) {
          return notFound(reply, `PLM record '${id}' not found.`);
        }
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to log cost entry.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── POST /api/v1/plm/records/:id/samples ─

  fastify.post(
    "/api/v1/plm/records/:id/samples",
    async (
      request: FastifyRequest<{ Params: RecordParams; Body: SampleRoundBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;

      if (!body.roundNumber || typeof body.roundNumber !== "number") {
        return badRequest(reply, "roundNumber (integer) is required.");
      }

      try {
        const round = await plmService.logSampleRound(id, {
          roundNumber: body.roundNumber,
          shippedAt: body.shippedAt ? new Date(body.shippedAt) : undefined,
          trackingNumber: body.trackingNumber,
          carrier: body.carrier,
          receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
          fitNotes: body.fitNotes,
          fitApproved: body.fitApproved,
          adjustments: body.adjustments,
        });
        return reply.status(201).send({ data: round });
      } catch (err: unknown) {
        if (isNotFoundError(err)) {
          return notFound(reply, `PLM record '${id}' not found.`);
        }
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to log sample round.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── GET /api/v1/plm/brands/:brandId/dashboard ─

  fastify.get(
    "/api/v1/plm/brands/:brandId/dashboard",
    async (
      request: FastifyRequest<{ Params: BrandParams }>,
      reply: FastifyReply
    ) => {
      const { brandId } = request.params;

      try {
        const dashboard = await plmService.getPLMDashboard(brandId);
        return reply.send({ data: dashboard });
      } catch (err: unknown) {
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve PLM dashboard.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── GET /api/v1/plm/brands/:brandId/overdue ─

  fastify.get(
    "/api/v1/plm/brands/:brandId/overdue",
    async (
      request: FastifyRequest<{ Params: BrandParams }>,
      reply: FastifyReply
    ) => {
      const { brandId } = request.params;

      try {
        const records = await plmService.getOverdueMilestones(brandId);
        return reply.send({ data: records, meta: { count: records.length } });
      } catch (err: unknown) {
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve overdue milestones.",
            requestId: request.id,
          },
        });
      }
    }
  );

  // ─── GET /api/v1/plm/brands/:brandId/cost-flags ─

  fastify.get(
    "/api/v1/plm/brands/:brandId/cost-flags",
    async (
      request: FastifyRequest<{ Params: BrandParams }>,
      reply: FastifyReply
    ) => {
      const { brandId } = request.params;

      try {
        const records = await plmService.getCostFlaggedRecords(brandId);
        return reply.send({ data: records, meta: { count: records.length } });
      } catch (err: unknown) {
        fastify.log.error(err);
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve cost-flagged styles.",
            requestId: request.id,
          },
        });
      }
    }
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Detect Prisma "record not found" errors.
 * Prisma throws P2025 when findUniqueOrThrow finds nothing.
 */
function isNotFoundError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as { code?: string };
    return e.code === "P2025";
  }
  return false;
}
