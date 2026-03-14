/**
 * Auth routes — thin wrapper around Supabase Auth.
 * The heavy lifting (JWT issuance, OAuth) is done by Supabase directly.
 * These endpoints handle post-auth actions: syncing the user to our DB,
 * fetching the current user's profile, and managing brand association.
 *
 * Authentication is validated by the global Supabase auth plugin (plugins/auth.ts)
 * which populates request.user. Route guards (requireAuth) block unauthenticated access.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { authService } from "./service.js";

/**
 * Register all /api/v1/auth/* routes.
 * Called from routes.ts with prefix "/api/v1/auth".
 */
export default async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/v1/auth/sync ───────────────────────────────────────────────────
  // Called after Supabase sign-up to ensure the user exists in our DB.
  // The Supabase auth plugin has already validated the token and set request.user.
  app.post("/sync", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      // request.user is guaranteed by requireAuth
      const { id, email } = request.user!;

      const profile = await authService.syncUser({ id, email });

      return reply.status(200).send({ data: profile });
    } catch (err) {
      request.log.error(err, "Error syncing user");
      return reply.status(500).send({
        error: {
          code: "SYNC_FAILED",
          message: "Failed to sync user.",
          requestId: request.id,
        },
      });
    }
  });

  // ── GET /api/v1/auth/me ──────────────────────────────────────────────────────
  // Fetch the authenticated user's full profile (user + brand/manufacturer context).
  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.user!;

      const profile = await authService.getUser(id);
      if (!profile) {
        return reply.status(404).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found.",
            requestId: request.id,
          },
        });
      }

      return reply.send({ data: profile });
    } catch (err) {
      request.log.error(err, "Error fetching user profile");
      return reply.status(500).send({
        error: {
          code: "FETCH_FAILED",
          message: "Failed to fetch profile.",
          requestId: request.id,
        },
      });
    }
  });
}
