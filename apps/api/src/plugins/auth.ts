/**
 * Supabase Auth plugin for Fastify.
 *
 * Registers a global preHandler that validates JWT tokens on every request.
 * Protected routes must call `requireAuth` (or a more specific guard) as an
 * additional preHandler — this plugin only _populates_ request.user, it does
 * not block unauthenticated requests by default (public routes need to exist).
 *
 * Service-to-service calls use: Authorization: Bearer INTERNAL:<secret>
 * All other calls use:          Authorization: Bearer <supabase-jwt>
 *
 * Security:
 *   - JWT verified against Supabase JWKS endpoint (RS256)
 *   - Secrets never logged
 *   - Token expiry strictly enforced
 *   - auth errors return identical 401 shape (no leaking of email existence)
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  UserRole,
  type RequestUser,
  type SupabaseJwtPayload,
} from "@loocbooc/types";

// ─── Module augmentation ──────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
  interface FastifyRequest {
    /** Populated for authenticated requests; undefined for public routes. */
    user?: RequestUser;
    /** True if the request came from an internal service call. */
    isServiceCall?: boolean;
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

interface AuthPluginOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Shared secret for service-to-service calls. Set via env, never hardcode. */
  internalServiceSecret?: string;
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  fastify,
  opts
) => {
  const { supabaseUrl, supabaseAnonKey, internalServiceSecret } = opts;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[auth] SUPABASE_URL and SUPABASE_ANON_KEY are required"
    );
  }

  // Decorate the Fastify instance with a Supabase admin client for server-side ops
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  fastify.decorate("supabase", supabase);

  /**
   * Global preHandler: attempts to populate request.user for every request.
   * Does NOT block unauthenticated requests — that's the job of requireAuth.
   */
  fastify.addHook("preHandler", async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return; // no token — public route, requireAuth will block if needed
    }

    const token = authHeader.slice(7); // strip "Bearer "

    // ── Service-to-service auth ──────────────────────────────────────────────
    if (token.startsWith("INTERNAL:")) {
      if (
        internalServiceSecret &&
        token === `INTERNAL:${internalServiceSecret}`
      ) {
        request.isServiceCall = true;
        return;
      }
      // Bad internal token — do not fall through to JWT validation
      return; // requireAuth will block if the route needs auth
    }

    // ── JWT validation via Supabase ──────────────────────────────────────────
    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data?.user) {
        // Token invalid or expired — leave request.user undefined
        // requireAuth will emit the 401 with a safe message
        return;
      }

      const supabaseUser = data.user;
      const appMeta = supabaseUser.app_metadata as SupabaseJwtPayload["app_metadata"] | undefined;

      // Our platform role lives in app_metadata.role (set during registration)
      // Fall back to consumer if somehow missing
      const rawRole = appMeta?.role ?? "consumer";
      const role = normaliseRole(rawRole);

      request.user = {
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        role,
        fullName:
          (supabaseUser.user_metadata as SupabaseJwtPayload["user_metadata"])
            ?.full_name ?? undefined,
      };
    } catch {
      // Catch-all: any unexpected error during token validation
      // Silently leave request.user undefined; requireAuth will block
    }
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map raw role string from JWT to our typed enum, defaulting to CONSUMER. */
function normaliseRole(raw: string): UserRole {
  const map: Record<string, UserRole> = {
    consumer: UserRole.CONSUMER,
    brand_owner: UserRole.BRAND_OWNER,
    brand_member: UserRole.BRAND_MEMBER,
    manufacturer: UserRole.MANUFACTURER,
    stylist: UserRole.STYLIST,
    platform_admin: UserRole.PLATFORM_ADMIN,
    // Legacy values from the original schema (admin → platform_admin)
    admin: UserRole.PLATFORM_ADMIN,
    brand: UserRole.BRAND_OWNER,
  };
  return map[raw] ?? UserRole.CONSUMER;
}

// ─── Safe 401 response ────────────────────────────────────────────────────────

/**
 * Emits a standardised 401 that does not leak whether the token was
 * expired, invalid, or simply missing. Intentionally vague per OWASP.
 */
export function sendUnauthorized(reply: FastifyReply): void {
  reply.status(401).send({
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required. Please sign in and try again.",
      requestId: (reply.request as FastifyRequest & { id: string }).id,
    },
  });
}

/**
 * Emits a standardised 403 for authenticated but insufficiently permissioned requests.
 */
export function sendForbidden(reply: FastifyReply, detail?: string): void {
  reply.status(403).send({
    error: {
      code: "FORBIDDEN",
      message: detail ?? "You do not have permission to perform this action.",
      requestId: (reply.request as FastifyRequest & { id: string }).id,
    },
  });
}

export default fp(authPlugin, {
  fastify: "4.x || 5.x",
  name: "auth",
});
