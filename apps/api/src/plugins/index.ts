/**
 * Plugin registration — auth, CORS, rate limiting, raw body parsing.
 * Called once at server startup.
 *
 * Auth strategy:
 *   JWT tokens are validated against Supabase's server-side getUser() API.
 *   This is more secure than local JWT secret validation — it catches revoked
 *   sessions, logout-invalidated tokens, and Supabase-managed token rotation.
 *   See: apps/api/src/plugins/auth.ts
 *
 *   Route guards (requireAuth, requireRole, etc.) are in:
 *   apps/api/src/modules/auth/guards.ts
 */

import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { redis } from "../lib/redis.js";
import supabaseAuthPlugin from "./auth.js";

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // CORS — allow configured origins
  await app.register(cors, {
    origin: (process.env["CORS_ORIGINS"] ?? "").split(",").filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // Rate limiting — Redis-backed (global default: 300 req/min per user/IP)
  // Per-route overrides are set via route config.rateLimit
  await app.register(rateLimit, {
    redis,
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      // Prefer user ID for authenticated requests (more accurate than IP for shared networks)
      return request.user?.id ?? request.ip;
    },
    errorResponseBuilder: (request, context) => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. Max ${context.max} requests per minute.`,
        details: { retryAfter: context.after },
        requestId: request.id,
      },
    }),
  });

  // Supabase Auth plugin — populates request.user on every request that carries
  // a valid Bearer token. Does NOT block unauthenticated requests on its own.
  // Use requireAuth (and other guards) as route preHandlers to enforce auth.
  await app.register(supabaseAuthPlugin, {
    supabaseUrl: process.env["SUPABASE_URL"] ?? "",
    supabaseAnonKey: process.env["SUPABASE_ANON_KEY"] ?? "",
    internalServiceSecret: process.env["INTERNAL_SERVICE_SECRET"],
  });

  // Raw body for webhook HMAC verification (Stripe, Shopify)
  // Must be registered after other content type parsers
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      try {
        const rawBody = body as Buffer;
        // Store raw body for HMAC verification (accessed by webhook handlers)
        (req as { rawBody?: Buffer }).rawBody = rawBody;
        const parsed: unknown = JSON.parse(rawBody.toString());
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
}
