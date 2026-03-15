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
import { stylistRoutes, briefRoutes } from "./modules/styling/routes";
import { shopifyWebhookRoutes } from "./webhooks/shopify";
import {
  garmentRoutes,
  brandStatsRoutes,
  fabricRoutes,
  scanRoutes,
} from "./modules/garments/routes";

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
  await app.register(stylistRoutes, { prefix: "/api/v1/stylists" });
  await app.register(briefRoutes, { prefix: "/api/v1/briefs" });

  // Garments module — core Production Tool API
  // GET/POST   /api/v1/garments
  // GET/PATCH/DELETE /api/v1/garments/:ugi
  // POST  /api/v1/garments/:ugi/files     — file upload notification
  // GET   /api/v1/garments/:ugi/scan/status
  await app.register(garmentRoutes, { prefix: "/api/v1/garments" });

  // Brand stats — used by the brand dashboard overview
  // GET /api/v1/brand/stats
  await app.register(brandStatsRoutes, { prefix: "/api/v1/brand" });

  // Fabric physics derivation
  // POST /api/v1/fabrics/physics
  await app.register(fabricRoutes, { prefix: "/api/v1/fabrics" });

  // Scan / OCR routes
  // POST /api/v1/scan/label
  await app.register(scanRoutes, { prefix: "/api/v1/scan" });

  // Webhooks — authenticated by HMAC, not JWT
  await app.register(shopifyWebhookRoutes, { prefix: "/webhooks" });
}
