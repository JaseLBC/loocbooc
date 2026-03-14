/**
 * Manufacturer Marketplace — API routes.
 *
 * Routes are thin: validate input → call service → return response.
 * Authentication via requireAuth / requireBrand / requireManufacturer guards.
 *
 * Endpoint map:
 *   GET    /api/v1/manufacturers              — search + filter
 *   GET    /api/v1/manufacturers/featured     — featured manufacturers
 *   GET    /api/v1/manufacturers/matched      — AI-matched for this brand
 *   GET    /api/v1/manufacturers/:id          — full profile
 *   POST   /api/v1/manufacturers/:id/enquire  — send enquiry
 *   POST   /api/v1/manufacturers/:id/rate     — submit rating
 *   PATCH  /api/v1/manufacturers/profile      — update own profile (manufacturer only)
 *   GET    /api/v1/manufacturers/connections  — brand's connections
 *   PATCH  /api/v1/manufacturers/connections/:id — respond to enquiry
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  requireAuth,
  requireManufacturer,
} from "../auth/guards.js";
import { sendForbidden } from "../../plugins/auth.js";
import {
  SearchManufacturersQuerySchema,
  ManufacturerParamsSchema,
  ConnectionParamsSchema,
  CreateEnquirySchema,
  RespondToEnquirySchema,
  SubmitRatingSchema,
  UpdateProfileSchema,
} from "./schema.js";
import {
  searchManufacturers,
  getManufacturerProfile,
  getFeaturedManufacturers,
  createEnquiry,
  respondToEnquiry,
  getBrandConnections,
  submitRating,
  updateProfile,
  getManufacturerIncomingConnections,
  getManufacturerProfileForOwner,
  ServiceError,
} from "./service.js";
import { getMatchedManufacturers } from "./matching.js";
import { prisma } from "@loocbooc/database";

// ── requireBrand guard ────────────────────────────────────────────────────────
// Allows brand_owner and brand_member roles. Used instead of requireRole
// to avoid the UserRole enum/type collision in the @loocbooc/types re-exports.

async function requireBrand(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.isServiceCall) return;
  const role = request.user?.role;
  if (role !== "brand_owner" && role !== "brand_member") {
    return sendForbidden(reply);
  }
}

export async function manufacturerRoutes(app: FastifyInstance): Promise<void> {

  // ── Error handler ──────────────────────────────────────────────────────────

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
    request.log.error(err, "Unhandled error in manufacturer route");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId: request.id,
      },
    });
  }

  // ── GET /api/v1/manufacturers ──────────────────────────────────────────────
  // Search with filters. Public endpoint.

  app.get("/", async (request, reply) => {
    const parseResult = SearchManufacturersQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters.",
          details: parseResult.error.flatten(),
          requestId: request.id,
        },
      });
    }
    try {
      const result = await searchManufacturers(parseResult.data);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/manufacturers/featured ────────────────────────────────────
  // Featured manufacturers for discovery homepage. Public.
  // NOTE: registered before /:id to avoid route conflict.

  app.get("/featured", async (request, reply) => {
    try {
      const result = await getFeaturedManufacturers();
      return reply.send({ data: result });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── GET /api/v1/manufacturers/matched ─────────────────────────────────────
  // AI-matched manufacturers for the authenticated brand.

  app.get(
    "/matched",
    { preHandler: [requireAuth, requireBrand] },
    async (request, reply) => {
      const userId = request.user!.id;

      // Look up the brand owned by this user
      const brand = await prisma.brand.findFirst({
        where: { ownerUserId: userId },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(403).send({
          error: {
            code: "BRAND_REQUIRED",
            message: "No brand found for this account.",
            requestId: request.id,
          },
        });
      }

      try {
        const result = await getMatchedManufacturers(brand.id);
        return reply.send(result);
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── GET /api/v1/manufacturers/connections ─────────────────────────────────
  // Brand's manufacturer connections.

  app.get(
    "/connections",
    { preHandler: [requireAuth, requireBrand] },
    async (request, reply) => {
      const userId = request.user!.id;

      const brand = await prisma.brand.findFirst({
        where: { ownerUserId: userId },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(403).send({
          error: {
            code: "BRAND_REQUIRED",
            message: "No brand found for this account.",
            requestId: request.id,
          },
        });
      }

      try {
        const connections = await getBrandConnections(brand.id);
        return reply.send({ data: connections });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── PATCH /api/v1/manufacturers/connections/:id ───────────────────────────
  // Respond to an enquiry. Manufacturer only.

  app.patch(
    "/connections/:id",
    { preHandler: [requireAuth, requireManufacturer] },
    async (request, reply) => {
      const paramsResult = ConnectionParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid connection ID.",
            requestId: request.id,
          },
        });
      }

      const bodyResult = RespondToEnquirySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body.",
            details: bodyResult.error.flatten(),
            requestId: request.id,
          },
        });
      }

      try {
        const result = await respondToEnquiry(
          paramsResult.data.id,
          request.user!.id,
          bodyResult.data,
        );
        return reply.send(result);
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── PATCH /api/v1/manufacturers/profile ───────────────────────────────────
  // Update manufacturer's own profile. Manufacturer only.

  app.patch(
    "/profile",
    { preHandler: [requireAuth, requireManufacturer] },
    async (request, reply) => {
      const bodyResult = UpdateProfileSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid profile data.",
            details: bodyResult.error.flatten(),
            requestId: request.id,
          },
        });
      }

      try {
        const result = await updateProfile(request.user!.id, bodyResult.data);
        return reply.send(result);
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── GET /api/v1/manufacturers/my-enquiries ────────────────────────────────
  // Manufacturer's incoming connection requests. Manufacturer only.

  app.get(
    "/my-enquiries",
    { preHandler: [requireAuth, requireManufacturer] },
    async (request, reply) => {
      try {
        const connections = await getManufacturerIncomingConnections(request.user!.id);
        return reply.send({ data: connections });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── GET /api/v1/manufacturers/my-profile ──────────────────────────────────
  // Manufacturer's own profile summary. Manufacturer only.

  app.get(
    "/my-profile",
    { preHandler: [requireAuth, requireManufacturer] },
    async (request, reply) => {
      try {
        const profile = await getManufacturerProfileForOwner(request.user!.id);
        return reply.send({ data: profile });
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── GET /api/v1/manufacturers/:id ─────────────────────────────────────────
  // Full manufacturer profile. Public.

  app.get("/:id", async (request, reply) => {
    const paramsResult = ManufacturerParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid manufacturer ID.",
          requestId: request.id,
        },
      });
    }

    try {
      const profile = await getManufacturerProfile(paramsResult.data.id);
      return reply.send(profile);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ── POST /api/v1/manufacturers/:id/enquire ────────────────────────────────
  // Send an enquiry to a manufacturer. Brand only.

  app.post(
    "/:id/enquire",
    { preHandler: [requireAuth, requireBrand] },
    async (request, reply) => {
      const paramsResult = ManufacturerParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid manufacturer ID.",
            requestId: request.id,
          },
        });
      }

      const bodyResult = CreateEnquirySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid enquiry.",
            details: bodyResult.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const brand = await prisma.brand.findFirst({
        where: { ownerUserId: request.user!.id },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(403).send({
          error: {
            code: "BRAND_REQUIRED",
            message: "No brand found for this account.",
            requestId: request.id,
          },
        });
      }

      try {
        const connection = await createEnquiry(
          brand.id,
          paramsResult.data.id,
          bodyResult.data,
        );
        return reply.status(201).send(connection);
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );

  // ── POST /api/v1/manufacturers/:id/rate ───────────────────────────────────
  // Submit a rating. Brand only. Requires CONNECTED relationship.

  app.post(
    "/:id/rate",
    { preHandler: [requireAuth, requireBrand] },
    async (request, reply) => {
      const paramsResult = ManufacturerParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid manufacturer ID.",
            requestId: request.id,
          },
        });
      }

      const bodyResult = SubmitRatingSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid rating data.",
            details: bodyResult.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const brand = await prisma.brand.findFirst({
        where: { ownerUserId: request.user!.id },
        select: { id: true },
      });

      if (!brand) {
        return reply.status(403).send({
          error: {
            code: "BRAND_REQUIRED",
            message: "No brand found for this account.",
            requestId: request.id,
          },
        });
      }

      try {
        const rating = await submitRating(
          brand.id,
          paramsResult.data.id,
          bodyResult.data,
        );
        return reply.status(201).send(rating);
      } catch (err) {
        return handleError(err, request, reply);
      }
    },
  );
}
