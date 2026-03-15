/**
 * Route registration — wires all module routes into the Fastify app.
 * Each module registers its own routes under /api/v1.
 */

import type { FastifyInstance } from "fastify";
import { backItRoutes } from "./modules/back-it/routes";
import authRoutes from "./modules/auth/routes";
import { manufacturerRoutes } from "./modules/manufacturer/routes";
import { plmRoutes } from "./modules/plm/routes";
import { adminRoutes } from "./modules/admin/routes";
import { avatarRoutes, sizeChartRoutes } from "./modules/avatar/routes";
import { tasteEngineRoutes } from "./modules/taste-engine/routes";
import { shopifyWebhookRoutes } from "./webhooks/shopify";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check — unauthenticated, used by load balancer
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // API v1 routes
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(backItRoutes, { prefix: "/api/v1" });
  await app.register(manufacturerRoutes, { prefix: "/api/v1/manufacturers" });
  await app.register(plmRoutes, { prefix: "/api/v1/plm" });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  await app.register(avatarRoutes, { prefix: "/api/v1/avatars" });
  await app.register(sizeChartRoutes, { prefix: "/api/v1/size-charts" });
  await app.register(tasteEngineRoutes, { prefix: "/api/v1/taste" });

  // Webhooks — authenticated by HMAC, not JWT
  await app.register(shopifyWebhookRoutes, { prefix: "/webhooks" });
}
