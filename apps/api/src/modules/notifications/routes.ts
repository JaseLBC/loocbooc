/**
 * Notifications API Routes
 *
 * Endpoints for consumer notification management:
 * - GET  /api/v1/notifications         — List notifications (paginated)
 * - GET  /api/v1/notifications/count   — Get unread count (for badge)
 * - GET  /api/v1/notifications/:id     — Get single notification
 * - POST /api/v1/notifications/:id/read — Mark as read
 * - POST /api/v1/notifications/read-all — Mark all as read
 * - POST /api/v1/notifications/read-batch — Mark multiple as read
 * - DELETE /api/v1/notifications/:id   — Delete notification
 *
 * All routes require authentication.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@loocbooc/database";
import {
  getNotifications,
  getNotification,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markMultipleAsRead,
  deleteNotification,
  ServiceError,
} from "./service.js";

// ─────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────

const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  unreadOnly: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const readBatchBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

// ─────────────────────────────────────────────
// Auth Helper
// ─────────────────────────────────────────────

/**
 * Extract authenticated user ID from request.
 * Throws 401 if not authenticated.
 */
function requireUserId(request: FastifyRequest): string {
  const userId = (request as unknown as { userId?: string }).userId;
  if (!userId) {
    throw new ServiceError("UNAUTHORIZED", "Authentication required", 401);
  }
  return userId;
}

// ─────────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────────

function handleError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ServiceError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: error.errors,
      },
    });
  }

  console.error("[Notifications] Unexpected error:", error);
  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}

// ─────────────────────────────────────────────
// Route Plugin
// ─────────────────────────────────────────────

export async function notificationRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /api/v1/notifications
   * List notifications for the authenticated user.
   */
  app.get("/notifications", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const query = listQuerySchema.parse(request.query);

      const result = await getNotifications(prisma, userId, {
        limit: query.limit,
        offset: query.offset,
        unreadOnly: query.unreadOnly,
      });

      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /api/v1/notifications/count
   * Get unread notification count (for badge display).
   */
  app.get("/notifications/count", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const result = await getUnreadCount(prisma, userId);
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /api/v1/notifications/:id
   * Get a single notification by ID.
   */
  app.get<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const { id } = idParamSchema.parse(request.params);

      const notification = await getNotification(prisma, userId, id);
      if (!notification) {
        throw new ServiceError("NOT_FOUND", "Notification not found", 404);
      }

      return reply.send(notification);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /api/v1/notifications/:id/read
   * Mark a single notification as read.
   */
  app.post<{ Params: { id: string } }>("/notifications/:id/read", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const { id } = idParamSchema.parse(request.params);

      const notification = await markAsRead(prisma, userId, id);
      if (!notification) {
        throw new ServiceError("NOT_FOUND", "Notification not found", 404);
      }

      return reply.send({ success: true });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /api/v1/notifications/read-all
   * Mark all notifications as read.
   */
  app.post("/notifications/read-all", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const result = await markAllAsRead(prisma, userId);
      return reply.send({ success: true, count: result.count });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /api/v1/notifications/read-batch
   * Mark multiple specific notifications as read.
   */
  app.post("/notifications/read-batch", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const { ids } = readBatchBodySchema.parse(request.body);

      const result = await markMultipleAsRead(prisma, userId, ids);
      return reply.send({ success: true, count: result.count });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * DELETE /api/v1/notifications/:id
   * Delete a notification.
   */
  app.delete<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const { id } = idParamSchema.parse(request.params);

      const deleted = await deleteNotification(prisma, userId, id);
      if (!deleted) {
        throw new ServiceError("NOT_FOUND", "Notification not found", 404);
      }

      return reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
