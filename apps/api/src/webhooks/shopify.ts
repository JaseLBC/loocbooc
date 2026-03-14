/**
 * Shopify webhook handler.
 * Receives POST /webhooks/shopify/:shopId for all registered Shopify webhook topics.
 *
 * Security model:
 * 1. Validate HMAC-SHA256 signature on every request (before any processing)
 * 2. Return 200 immediately (Shopify times out at 5 seconds)
 * 3. Enqueue the payload for async processing by the shopify-sync worker
 *
 * Registered topics: orders/create, orders/paid, orders/cancelled, app/uninstalled
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import crypto from "crypto";
import { enqueueJob } from "../lib/queues";

const SHOPIFY_WEBHOOK_SECRET = process.env["SHOPIFY_WEBHOOK_SECRET"] ?? "";

/**
 * Validate Shopify HMAC-SHA256 signature.
 * The signature is computed from the raw request body.
 */
function validateShopifyHmac(rawBody: Buffer, hmacHeader: string): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET || !hmacHeader) return false;

  const computed = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");

  // Use timingSafeEqual to prevent timing attacks
  const computedBuf = Buffer.from(computed);
  const providedBuf = Buffer.from(hmacHeader);

  if (computedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, providedBuf);
}

export async function shopifyWebhookRoutes(app: FastifyInstance): Promise<void> {

  app.post("/shopify/:shopId", async (request: FastifyRequest, reply) => {
    const { shopId } = request.params as { shopId: string };
    const hmac = request.headers["x-shopify-hmac-sha256"] as string | undefined;
    const topic = request.headers["x-shopify-topic"] as string | undefined;

    if (!hmac || !topic) {
      return reply.status(400).send({ error: "Missing required Shopify headers." });
    }

    // Validate HMAC — reject invalid requests before any processing
    const rawBody = (request as { rawBody?: Buffer }).rawBody;
    if (!rawBody || !validateShopifyHmac(rawBody, hmac)) {
      request.log.warn({ shopId, topic }, "Shopify webhook HMAC validation failed");
      return reply.status(401).send();
    }

    // Acknowledge immediately — Shopify gives us 5 seconds
    reply.status(200).send();

    // Enqueue for async processing — don't block the response
    try {
      await enqueueJob("shopify-sync", `shopify-${topic}`, {
        shopId,
        topic,
        payload: request.body as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err, shopId, topic }, "Failed to enqueue Shopify webhook");
    }
  });
}
