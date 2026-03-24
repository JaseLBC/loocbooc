/**
 * Retail Platform — Fastify route handlers.
 *
 * Route map:
 *
 * PUBLIC (no auth)
 *   GET  /api/v1/products                          — Browse/search active products
 *   GET  /api/v1/products/slug/:slug               — Get product by slug
 *   GET  /api/v1/products/:id                      — Get product by ID
 *
 * CONSUMER (requires auth)
 *   GET  /api/v1/cart                              — Get or create cart
 *   POST /api/v1/cart/items                        — Add item to cart
 *   PATCH /api/v1/cart/items/:itemId               — Update cart item quantity (0 = remove)
 *   DELETE /api/v1/cart                            — Clear cart
 *   POST /api/v1/retail/checkout                   — Create checkout session (Stripe PI)
 *   POST /api/v1/retail/orders/:orderId/confirm    — Confirm order after Stripe success
 *   GET  /api/v1/retail/orders                     — List consumer's orders
 *   GET  /api/v1/retail/orders/:orderId            — Get single order
 *
 * BRAND (requires brand member auth)
 *   GET  /api/v1/retail/brands/:brandId/products   — List brand's products (includes drafts)
 *   POST /api/v1/retail/products                   — Create product
 *   PATCH /api/v1/retail/products/:id              — Update product
 *   POST /api/v1/retail/products/:id/publish       — Publish draft product
 *   POST /api/v1/retail/products/:id/archive       — Archive product
 *   GET  /api/v1/retail/brands/:brandId/stats      — Brand product stats
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import {
  CreateProductSchema,
  UpdateProductSchema,
  BrowseProductsQuerySchema,
  AddToCartSchema,
  UpdateCartItemSchema,
  CreateCheckoutSessionSchema,
  ConfirmOrderSchema,
} from "./schema.js";
import {
  createProduct,
  getProduct,
  getProductBySlug,
  updateProduct,
  publishProduct,
  archiveProduct,
  listBrandProducts,
  getBrandProductStats,
  browseProducts,
  getOrCreateCart,
  addToCart,
  updateCartItem,
  clearCart,
  createCheckoutSession,
  confirmRetailOrder,
  getRetailOrder,
  listConsumerOrders,
  ServiceError,
} from "./service.js";

// ─────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────

function handleError(err: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ServiceError) {
    return reply.status(err.statusCode).send({
      error: { code: err.code, message: err.message, details: err.details ?? null, requestId: request.id },
    });
  }
  request.log.error(err, "Unhandled error in Retail route");
  return reply.status(500).send({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId: request.id },
  });
}

// ─────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────

export async function retailRoutes(app: FastifyInstance): Promise<void> {

  // ────────────────────────────────────────────
  // PUBLIC — Product Browse
  // ────────────────────────────────────────────

  // GET /api/v1/products — browse active products
  app.get("/products", async (request, reply) => {
    try {
      const query = BrowseProductsQuerySchema.parse(request.query);
      const result = await browseProducts(query);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/products/slug/:slug — get product by public slug
  app.get("/products/slug/:slug", async (request, reply) => {
    try {
      const { slug } = z.object({ slug: z.string().min(1).max(150) }).parse(request.params);
      const product = await getProductBySlug(slug);
      return reply.send({ data: product });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/products/:id — get product by ID
  app.get("/products/:id", async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
      const product = await getProduct(id);
      return reply.send({ data: product });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ────────────────────────────────────────────
  // CONSUMER — Cart
  // ────────────────────────────────────────────

  // GET /api/v1/cart — get or create the user's cart
  app.get("/cart", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const cart = await getOrCreateCart(userId);
      return reply.send({ data: cart });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/cart/items — add item to cart
  app.post("/cart/items", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const body = AddToCartSchema.parse(request.body);
      const cart = await addToCart(userId, body);
      return reply.status(201).send({ data: cart });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/cart/items/:itemId — update cart item quantity
  app.patch("/cart/items/:itemId", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { itemId } = z.object({ itemId: z.string().cuid() }).parse(request.params);
      const body = UpdateCartItemSchema.parse(request.body);
      const cart = await updateCartItem(userId, itemId, body);
      return reply.send({ data: cart });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // DELETE /api/v1/cart — clear the cart
  app.delete("/cart", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      await clearCart(userId);
      return reply.status(204).send();
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ────────────────────────────────────────────
  // CONSUMER — Checkout & Orders
  // ────────────────────────────────────────────

  // POST /api/v1/retail/checkout — create checkout session (Stripe PaymentIntent)
  app.post("/retail/checkout", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const body = CreateCheckoutSessionSchema.parse(request.body);
      const result = await createCheckoutSession(userId, body);
      return reply.status(201).send({ data: result });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/retail/orders/:orderId/confirm — confirm order after Stripe success
  app.post("/retail/orders/:orderId/confirm", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { orderId } = z.object({ orderId: z.string().cuid() }).parse(request.params);
      const body = ConfirmOrderSchema.parse(request.body);
      if (body.orderId !== orderId) {
        return reply.status(400).send({ error: { code: "ID_MISMATCH", message: "Order ID mismatch." } });
      }
      const order = await confirmRetailOrder(userId, body);
      return reply.send({ data: order });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/retail/orders — list consumer's orders
  app.get("/retail/orders", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const query = z.object({
        limit:  z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(request.query);
      const result = await listConsumerOrders(userId, query);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/retail/orders/:orderId — get a single order
  app.get("/retail/orders/:orderId", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { orderId } = z.object({ orderId: z.string().cuid() }).parse(request.params);
      const order = await getRetailOrder(userId, orderId);
      return reply.send({ data: order });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // ────────────────────────────────────────────
  // BRAND — Product Management
  // ────────────────────────────────────────────

  // POST /api/v1/retail/products — create product
  app.post("/retail/products", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const body = CreateProductSchema.parse(request.body);
      const product = await createProduct(userId, body);
      return reply.status(201).send({ data: product });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // PATCH /api/v1/retail/products/:id — update product
  app.patch("/retail/products/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
      const body = UpdateProductSchema.parse(request.body);
      const product = await updateProduct(id, userId, body);
      return reply.send({ data: product });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/retail/products/:id/publish — publish product
  app.post("/retail/products/:id/publish", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
      const product = await publishProduct(id, userId);
      return reply.send({ data: product });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // POST /api/v1/retail/products/:id/archive — archive product
  app.post("/retail/products/:id/archive", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
      const product = await archiveProduct(id, userId);
      return reply.send({ data: product });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/retail/brands/:brandId/products — list brand products (brand portal)
  app.get("/retail/brands/:brandId/products", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { brandId } = z.object({ brandId: z.string().cuid() }).parse(request.params);
      const query = z.object({
        limit:  z.coerce.number().int().min(1).max(100).default(25),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.enum(["draft", "active", "archived", "out_of_stock"]).optional(),
        search: z.string().max(200).optional(),
      }).parse(request.query);
      const result = await listBrandProducts(brandId, userId, query);
      return reply.send(result);
    } catch (err) {
      return handleError(err, request, reply);
    }
  });

  // GET /api/v1/retail/brands/:brandId/stats — brand product stats
  app.get("/retail/brands/:brandId/stats", { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const { brandId } = z.object({ brandId: z.string().cuid() }).parse(request.params);
      const stats = await getBrandProductStats(brandId, userId);
      return reply.send({ data: stats });
    } catch (err) {
      return handleError(err, request, reply);
    }
  });
}
