/**
 * Shopify Webhook Handler
 * ========================
 * Handles all inbound Shopify webhooks for the Loocbooc Back It module.
 *
 * Security: Every webhook validates the Shopify HMAC-SHA256 signature
 * before processing. Any request with an invalid or missing HMAC is
 * rejected with 401. No exceptions.
 *
 * Processing model: webhook handlers return 200 immediately, then enqueue
 * heavy work to BullMQ. Shopify times out webhook delivery at 5 seconds.
 *
 * GDPR webhooks (shop/redact, customers/redact, customers/data_request)
 * are required for Shopify App Store approval and are handled here.
 */

import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw body buffer — Fastify must be configured with addContentTypeParser for raw. */
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

interface ShopifyOrderPayload {
  id: number;
  name: string;
  note_attributes?: Array<{ name: string; value: string }>;
  line_items?: Array<{
    id: number;
    product_id: number;
    variant_id: number;
    quantity: number;
    properties?: Array<{ name: string; value: string }>;
  }>;
  financial_status?: string;
  cancel_reason?: string | null;
  customer?: {
    id: number;
    email: string;
  };
}

interface ShopifyGdprPayload {
  shop_id: number;
  shop_domain: string;
  customer?: { id: number; email: string };
  orders_to_redact?: number[];
  data_request?: { id: number };
}

// ---------------------------------------------------------------------------
// HMAC validation
// ---------------------------------------------------------------------------

/**
 * Validate a Shopify webhook HMAC-SHA256 signature.
 *
 * Shopify computes: HMAC-SHA256(apiSecret, rawBody)
 * and sends it as the `X-Shopify-Hmac-SHA256` header (Base64-encoded).
 *
 * @param rawBody  - The raw request body buffer (must not be parsed)
 * @param hmacHeader - Value of `X-Shopify-Hmac-SHA256` header
 * @param apiSecret  - The Shopify API secret for the app
 * @returns true if the signature is valid
 */
export function validateShopifyHmac(
  rawBody: Buffer,
  hmacHeader: string,
  apiSecret: string
): boolean {
  if (!hmacHeader || !rawBody.length) return false;

  const computed = crypto
    .createHmac("sha256", apiSecret)
    .update(rawBody)
    .digest("base64");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(hmacHeader)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register the Shopify webhook endpoint on the Fastify instance.
 *
 * Route: POST /webhooks/shopify/:shopId
 *
 * @param fastify - Fastify application instance
 */
export async function registerShopifyWebhookRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post<{
    Params: { shopId: string };
    Headers: {
      "x-shopify-hmac-sha256"?: string;
      "x-shopify-topic"?: string;
      "x-shopify-shop-domain"?: string;
      "x-shopify-webhook-id"?: string;
    };
  }>(
    "/webhooks/shopify/:shopId",
    {
      config: {
        // Tell Fastify to preserve the raw body for HMAC validation.
        // This requires the `fastify-raw-body` plugin to be registered.
        rawBody: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const hmacHeader = request.headers["x-shopify-hmac-sha256"] ?? "";
      const topic = request.headers["x-shopify-topic"] ?? "";
      const shopDomain = request.headers["x-shopify-shop-domain"] ?? "";
      const webhookId = request.headers["x-shopify-webhook-id"] ?? "";
      const rawBody = request.rawBody;

      // -----------------------------------------------------------------------
      // Step 1: Validate HMAC — reject immediately if invalid
      // -----------------------------------------------------------------------
      if (!rawBody) {
        request.log.warn({ topic, shopDomain }, "Shopify webhook missing raw body");
        return reply.status(400).send();
      }

      const apiSecret = process.env.SHOPIFY_API_SECRET;
      if (!apiSecret) {
        request.log.error("SHOPIFY_API_SECRET not configured");
        return reply.status(500).send();
      }

      if (!validateShopifyHmac(rawBody, hmacHeader, apiSecret)) {
        request.log.warn(
          { topic, shopDomain, webhookId },
          "Shopify webhook HMAC validation failed — rejecting"
        );
        return reply.status(401).send();
      }

      // -----------------------------------------------------------------------
      // Step 2: Acknowledge immediately (Shopify 5-second timeout)
      // -----------------------------------------------------------------------
      reply.status(200).send();

      // -----------------------------------------------------------------------
      // Step 3: Enqueue async processing via BullMQ
      // -----------------------------------------------------------------------
      try {
        await processShopifyWebhook({
          topic,
          shopDomain,
          shopId: request.params.shopId,
          webhookId,
          payload: request.body as Record<string, unknown>,
          log: request.log,
        });
      } catch (err) {
        request.log.error(
          { err, topic, shopDomain, webhookId },
          "Shopify webhook processing error"
        );
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

interface WebhookContext {
  topic: string;
  shopDomain: string;
  shopId: string;
  webhookId: string;
  payload: Record<string, unknown>;
  log: FastifyInstance["log"];
}

/**
 * Route a validated webhook to the appropriate handler.
 *
 * @param ctx - Webhook context including topic, payload, and logger
 */
async function processShopifyWebhook(ctx: WebhookContext): Promise<void> {
  const { topic, shopDomain, payload, log } = ctx;

  log.info({ topic, shopDomain }, "Processing Shopify webhook");

  switch (topic) {
    case "orders/paid":
      await handleOrdersPaid(ctx, payload as unknown as ShopifyOrderPayload);
      break;

    case "orders/cancelled":
      await handleOrdersCancelled(ctx, payload as unknown as ShopifyOrderPayload);
      break;

    case "app/uninstalled":
      await handleAppUninstalled(ctx);
      break;

    case "shop/redact":
      await handleShopRedact(ctx, payload as unknown as ShopifyGdprPayload);
      break;

    case "customers/redact":
      await handleCustomersRedact(ctx, payload as unknown as ShopifyGdprPayload);
      break;

    case "customers/data_request":
      await handleCustomersDataRequest(ctx, payload as unknown as ShopifyGdprPayload);
      break;

    default:
      log.warn({ topic }, "Unhandled Shopify webhook topic");
  }
}

// ---------------------------------------------------------------------------
// orders/paid
// ---------------------------------------------------------------------------

/**
 * Handle the `orders/paid` webhook.
 *
 * When a Shopify order is paid:
 * 1. Find the backing record linked to this Shopify order ID
 * 2. Update backing.deposit_status → 'succeeded'
 * 3. Enqueue a MOQ threshold check for the campaign
 *
 * @param ctx   - Webhook context
 * @param order - Shopify order payload
 */
async function handleOrdersPaid(
  ctx: WebhookContext,
  order: ShopifyOrderPayload
): Promise<void> {
  const { shopDomain, log } = ctx;
  const shopifyOrderId = String(order.id);

  log.info({ shopifyOrderId, shopDomain }, "orders/paid received");

  try {
    // Extract campaign ID from order note_attributes or line item properties
    const campaignId = extractCampaignId(order);

    if (!campaignId) {
      log.info({ shopifyOrderId }, "orders/paid: no Back It campaign — skipping");
      return;
    }

    // Enqueue the backing confirmation job
    await enqueueJob("shopify.confirm-backing-payment", {
      shopifyOrderId,
      shopDomain,
      campaignId,
      order,
    });

    log.info(
      { shopifyOrderId, campaignId },
      "orders/paid: enqueued confirm-backing-payment job"
    );
  } catch (err) {
    log.error({ err, shopifyOrderId }, "orders/paid handler error");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// orders/cancelled
// ---------------------------------------------------------------------------

/**
 * Handle the `orders/cancelled` webhook.
 *
 * When a Shopify order is cancelled:
 * 1. Find the backing record linked to this Shopify order ID
 * 2. If the campaign hasn't hit MOQ, cancel the backing and trigger refund
 * 3. If MOQ has already been reached, flag for manual review
 *
 * @param ctx   - Webhook context
 * @param order - Shopify order payload
 */
async function handleOrdersCancelled(
  ctx: WebhookContext,
  order: ShopifyOrderPayload
): Promise<void> {
  const { shopDomain, log } = ctx;
  const shopifyOrderId = String(order.id);

  log.info({ shopifyOrderId, shopDomain, cancelReason: order.cancel_reason }, "orders/cancelled received");

  try {
    const campaignId = extractCampaignId(order);

    if (!campaignId) {
      log.info({ shopifyOrderId }, "orders/cancelled: no Back It campaign — skipping");
      return;
    }

    await enqueueJob("shopify.cancel-backing", {
      shopifyOrderId,
      shopDomain,
      campaignId,
      cancelReason: order.cancel_reason ?? "customer_request",
      order,
    });

    log.info(
      { shopifyOrderId, campaignId },
      "orders/cancelled: enqueued cancel-backing job"
    );
  } catch (err) {
    log.error({ err, shopifyOrderId }, "orders/cancelled handler error");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// app/uninstalled
// ---------------------------------------------------------------------------

/**
 * Handle the `app/uninstalled` webhook.
 *
 * When a brand uninstalls the Back It app from their Shopify store:
 * 1. Nullify the brand's shopify_access_token in the database
 * 2. Mark active campaigns for that store as needing attention
 * 3. Log the uninstallation event for operational visibility
 *
 * Note: The Shopify session is already invalidated by the platform.
 * We're handling the Loocbooc-side cleanup here.
 *
 * @param ctx - Webhook context
 */
async function handleAppUninstalled(ctx: WebhookContext): Promise<void> {
  const { shopDomain, log } = ctx;

  log.warn({ shopDomain }, "app/uninstalled received — cleaning up brand integration");

  try {
    await enqueueJob("shopify.app-uninstalled", {
      shopDomain,
      uninstalledAt: new Date().toISOString(),
    });

    log.info({ shopDomain }, "app/uninstalled: enqueued cleanup job");
  } catch (err) {
    log.error({ err, shopDomain }, "app/uninstalled handler error");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GDPR — shop/redact
// ---------------------------------------------------------------------------

/**
 * Handle the `shop/redact` GDPR webhook.
 *
 * Shopify sends this 48 hours after a store uninstalls the app.
 * We must delete or anonymise all data associated with the shop.
 *
 * Required for Shopify App Store approval.
 *
 * @param ctx     - Webhook context
 * @param payload - GDPR payload
 */
async function handleShopRedact(
  ctx: WebhookContext,
  payload: ShopifyGdprPayload
): Promise<void> {
  const { log } = ctx;
  const { shop_domain, shop_id } = payload;

  log.info({ shopDomain: shop_domain, shopId: shop_id }, "shop/redact GDPR webhook received");

  await enqueueJob("gdpr.shop-redact", {
    shopDomain: shop_domain,
    shopId: shop_id,
    requestedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// GDPR — customers/redact
// ---------------------------------------------------------------------------

/**
 * Handle the `customers/redact` GDPR webhook.
 *
 * A customer has requested erasure of their data.
 * We must delete or anonymise all PII for this customer
 * across all Loocbooc records linked to this Shopify store.
 *
 * Required for Shopify App Store approval.
 *
 * @param ctx     - Webhook context
 * @param payload - GDPR payload
 */
async function handleCustomersRedact(
  ctx: WebhookContext,
  payload: ShopifyGdprPayload
): Promise<void> {
  const { log } = ctx;
  const { shop_domain, customer, orders_to_redact } = payload;

  log.info(
    {
      shopDomain: shop_domain,
      customerId: customer?.id,
      ordersToRedact: orders_to_redact?.length ?? 0,
    },
    "customers/redact GDPR webhook received"
  );

  await enqueueJob("gdpr.customer-redact", {
    shopDomain: shop_domain,
    customerId: customer?.id,
    customerEmail: customer?.email,
    shopifyOrderIds: orders_to_redact ?? [],
    requestedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// GDPR — customers/data_request
// ---------------------------------------------------------------------------

/**
 * Handle the `customers/data_request` GDPR webhook.
 *
 * A customer has requested a copy of their personal data.
 * We must compile and deliver a data export within the regulatory timeframe.
 *
 * Required for Shopify App Store approval.
 *
 * @param ctx     - Webhook context
 * @param payload - GDPR payload
 */
async function handleCustomersDataRequest(
  ctx: WebhookContext,
  payload: ShopifyGdprPayload
): Promise<void> {
  const { log } = ctx;
  const { shop_domain, customer, data_request } = payload;

  log.info(
    {
      shopDomain: shop_domain,
      customerId: customer?.id,
      dataRequestId: data_request?.id,
    },
    "customers/data_request GDPR webhook received"
  );

  await enqueueJob("gdpr.customer-data-request", {
    shopDomain: shop_domain,
    customerId: customer?.id,
    customerEmail: customer?.email,
    dataRequestId: data_request?.id,
    requestedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Extract the Loocbooc campaign ID from a Shopify order.
 * The campaign ID is stored as a note attribute or line item property
 * when the order is created via the Back It widget.
 *
 * @param order - Shopify order payload
 * @returns The campaign ID string, or null if not a Back It order
 */
function extractCampaignId(order: ShopifyOrderPayload): string | null {
  // Check note_attributes first (set by the Loocbooc checkout flow)
  const noteAttr = order.note_attributes?.find(
    (attr) => attr.name === "_loocbooc_campaign_id"
  );
  if (noteAttr?.value) return noteAttr.value;

  // Check line item properties (set by the Shopify checkout flow via back-it.js)
  for (const item of order.line_items ?? []) {
    const prop = item.properties?.find((p) => p.name === "_campaign_id");
    if (prop?.value) return prop.value;
  }

  return null;
}

/**
 * Enqueue a BullMQ job for async processing.
 *
 * In production this imports the BullMQ queue from the workers package.
 * The job name maps to a registered BullMQ processor in services/workers.
 *
 * @param jobName - BullMQ job name (maps to processor registration)
 * @param data    - Job payload
 */
async function enqueueJob(
  jobName: string,
  data: Record<string, unknown>
): Promise<void> {
  // Dynamic import to avoid circular dependencies during testing
  // In production, replace with direct import of the queue singleton:
  //   import { shopifyQueue } from "@loocbooc/workers/queues";
  //   await shopifyQueue.add(jobName, data, { attempts: 3, backoff: { type: "exponential", delay: 1000 } });

  // Stub implementation — logs intent for now
  console.info(`[enqueueJob] ${jobName}`, JSON.stringify(data).slice(0, 200));

  // TODO: wire up to BullMQ shopify queue once workers package is scaffolded
  // Example:
  // const { Queue } = await import("bullmq");
  // const queue = new Queue("shopify", { connection: redisConnection });
  // await queue.add(jobName, data, {
  //   attempts: 3,
  //   backoff: { type: "exponential", delay: 2000 },
  //   removeOnComplete: { count: 1000 },
  //   removeOnFail: { count: 5000 },
  // });
}
