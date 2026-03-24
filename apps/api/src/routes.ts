/**
 * Route registration — wires all module routes into the Fastify app.
 * Each module registers its own routes under /api/v1.
 */

import type { FastifyInstance } from "fastify";
import { backItRoutes } from "./modules/back-it/routes";
import authRoutes from "./modules/auth/routes";
import { manufacturerRoutes } from "./modules/manufacturer/routes";
import { plmRoutes } from "./modules/plm/routes";
import { PLMService } from "./modules/plm/service";
import { prisma } from "@loocbooc/database";
import { adminRoutes } from "./modules/admin/routes";
import { avatarRoutes, sizeChartRoutes } from "./modules/avatar/routes";
import { tasteEngineRoutes } from "./modules/taste-engine/routes";
import { stylistRoutes, briefRoutes } from "./modules/styling/routes";
import { retailRoutes } from "./modules/retail/routes";
import { shopifyWebhookRoutes } from "./webhooks/shopify";
import { stripeWebhookRoutes } from "./webhooks/stripe";
import {
  garmentRoutes,
  brandStatsRoutes,
  fabricRoutes,
  scanRoutes,
} from "./modules/garments/routes";
import { notificationRoutes } from "./modules/notifications/routes";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check — unauthenticated, used by load balancer
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // API v1 routes
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(backItRoutes, { prefix: "/api/v1" });
  await app.register(manufacturerRoutes, { prefix: "/api/v1/manufacturers" });
  await app.register(plmRoutes, { prefix: "/api/v1/plm", plmService: new PLMService(prisma) });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  await app.register(avatarRoutes, { prefix: "/api/v1/avatars" });
  await app.register(sizeChartRoutes, { prefix: "/api/v1/size-charts" });
  await app.register(tasteEngineRoutes, { prefix: "/api/v1/taste" });
  await app.register(stylistRoutes, { prefix: "/api/v1/stylists" });
  await app.register(briefRoutes, { prefix: "/api/v1/briefs" });

  // Retail Platform — product listings, cart, checkout, orders
  // GET/POST  /api/v1/products
  // GET/PATCH /api/v1/products/:id
  // GET  /api/v1/products/slug/:slug
  // GET  /api/v1/cart, POST /api/v1/cart/items, PATCH /api/v1/cart/items/:itemId
  // POST /api/v1/retail/checkout
  // POST /api/v1/retail/orders/:orderId/confirm
  // GET  /api/v1/retail/orders
  // GET  /api/v1/retail/brands/:brandId/products
  // GET  /api/v1/retail/brands/:brandId/stats
  await app.register(retailRoutes, { prefix: "/api/v1" });

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

  // Notifications — consumer in-app notifications
  // GET  /api/v1/notifications
  // GET  /api/v1/notifications/count
  // GET  /api/v1/notifications/:id
  // POST /api/v1/notifications/:id/read
  // POST /api/v1/notifications/read-all
  // POST /api/v1/notifications/read-batch
  // DELETE /api/v1/notifications/:id
  await app.register(notificationRoutes, { prefix: "/api/v1" });

  // Webhooks — authenticated by HMAC / Stripe signature, not JWT
  await app.register(shopifyWebhookRoutes, { prefix: "/webhooks" });
  await app.register(stripeWebhookRoutes, { prefix: "/webhooks" });
}
