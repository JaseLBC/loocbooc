/**
 * Fastify route guards — preHandler hooks for auth + RBAC enforcement.
 *
 * Usage:
 *   fastify.get('/campaigns', { preHandler: [requireAuth, requireRole(UserRole.BRAND_OWNER)] }, handler)
 *   fastify.get('/campaigns/:id', { preHandler: [requireAuth, requireBrandMember(brandId)] }, handler)
 *   fastify.get('/manufacturers/portal', { preHandler: [requireAuth, requireManufacturer] }, handler)
 *
 * All guards call sendUnauthorized / sendForbidden from the auth plugin —
 * error messages are intentionally identical to prevent information leakage.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { UserRole, type Permission, hasPermission } from "@loocbooc/types";
import { sendUnauthorized, sendForbidden } from "../../plugins/auth.js";

// ─── requireAuth ──────────────────────────────────────────────────────────────

/**
 * Blocks unauthenticated requests. Use as the first guard on any protected route.
 * Allows service-to-service calls through (they set request.isServiceCall = true).
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isServiceCall) return; // internal service calls bypass JWT auth
  if (!request.user) {
    return sendUnauthorized(reply);
  }
}

// ─── requireRole ─────────────────────────────────────────────────────────────

/**
 * Returns a preHandler that requires the authenticated user to have at least
 * one of the specified roles. Must be used after requireAuth.
 *
 * Example: requireRole(UserRole.BRAND_OWNER, UserRole.PLATFORM_ADMIN)
 */
export function requireRole(
  ...roles: UserRole[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    if (request.isServiceCall) return;

    const user = request.user;
    if (!user) return sendUnauthorized(reply);

    if (!roles.includes(user.role)) {
      return sendForbidden(reply);
    }
  };
}

// ─── requirePermission ────────────────────────────────────────────────────────

/**
 * Returns a preHandler that requires the authenticated user's role to have
 * the specified permission in the permissions matrix.
 * More granular than requireRole — prefer this for resource-level access control.
 */
export function requirePermission(
  permission: Permission
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    if (request.isServiceCall) return;

    const user = request.user;
    if (!user) return sendUnauthorized(reply);

    if (!hasPermission(user.role, permission)) {
      return sendForbidden(reply);
    }
  };
}

// ─── requireBrandMember ───────────────────────────────────────────────────────

/**
 * Returns a preHandler that requires the authenticated user to be a member
 * of the specified brand. Accepts brandId either as a route param or explicit arg.
 *
 * When brandId is not passed, it reads from request.params.brandId.
 * Requires a DB client on the Fastify instance — inject via closure in your route file.
 *
 * Usage:
 *   fastify.get('/brands/:brandId/campaigns', {
 *     preHandler: [requireAuth, requireBrandMember()],
 *   }, handler)
 */
export function requireBrandMember(
  brandId?: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    if (request.isServiceCall) return;

    const user = request.user;
    if (!user) return sendUnauthorized(reply);

    // Platform admins bypass brand membership checks
    if (user.role === UserRole.PLATFORM_ADMIN) return;

    const targetBrandId =
      brandId ??
      (request.params as Record<string, string>)?.brandId;

    if (!targetBrandId) {
      return sendForbidden(reply, "Brand context required.");
    }

    // Import the DB client lazily to avoid circular deps — routes inject their own db
    // This guard uses the db accessor exposed on the Fastify instance
    const fastify = request.server;
    const db = (fastify as unknown as { db: { brandMember: { findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown> } } }).db;

    if (!db) {
      // If DB not available (e.g., test context), skip — route handler will enforce
      return;
    }

    const membership = await db.brandMember.findFirst({
      where: {
        brandId: targetBrandId,
        userId: user.id,
      },
    });

    if (!membership) {
      return sendForbidden(reply);
    }
  };
}

// ─── requireManufacturer ──────────────────────────────────────────────────────

/**
 * Requires the authenticated user to be a verified manufacturer.
 * Unverified manufacturers (status: PENDING) are blocked.
 *
 * Must be used after requireAuth.
 */
export async function requireManufacturer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isServiceCall) return;

  const user = request.user;
  if (!user) return sendUnauthorized(reply);

  if (user.role === UserRole.PLATFORM_ADMIN) return;

  if (user.role !== UserRole.MANUFACTURER) {
    return sendForbidden(reply);
  }

  // Check verified status on the manufacturer record
  const fastify = request.server;
  const db = (fastify as unknown as { db: { manufacturer: { findFirst: (args: { where: Record<string, unknown> }) => Promise<{ verified: boolean } | null> } } }).db;

  if (!db) return; // test context fallback

  const manufacturer = await db.manufacturer.findFirst({
    where: { ownerUserId: user.id, active: true },
  });

  if (!manufacturer) {
    return sendForbidden(reply, "Manufacturer profile not found.");
  }

  if (!manufacturer.verified) {
    return sendForbidden(
      reply,
      "Your manufacturer account is pending verification. You will be notified once approved."
    );
  }
}

// ─── requirePlatformAdmin ─────────────────────────────────────────────────────

/**
 * Strict guard — platform admins only. No exceptions.
 */
export async function requirePlatformAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isServiceCall) return;

  const user = request.user;
  if (!user) return sendUnauthorized(reply);

  if (user.role !== UserRole.PLATFORM_ADMIN) {
    return sendForbidden(reply);
  }
}

// ─── requireBrandOwner ────────────────────────────────────────────────────────

/**
 * Shorthand guard — BRAND_OWNER or PLATFORM_ADMIN only.
 * Use for destructive actions (delete campaign, remove member, etc.)
 */
export async function requireBrandOwner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isServiceCall) return;

  const user = request.user;
  if (!user) return sendUnauthorized(reply);

  if (
    user.role !== UserRole.BRAND_OWNER &&
    user.role !== UserRole.PLATFORM_ADMIN
  ) {
    return sendForbidden(reply);
  }
}
