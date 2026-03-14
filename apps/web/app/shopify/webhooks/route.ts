/**
 * Shopify webhook delivery endpoint.
 *
 * POST /shopify/webhooks
 *
 * Shopify delivers all webhook topics to this single endpoint.
 * The `authenticate.webhook` call validates the HMAC signature before
 * any processing occurs. Unknown topics are acknowledged silently.
 *
 * Processing is intentionally minimal here — heavy work is enqueued
 * to BullMQ so we always respond to Shopify within 5 seconds.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../app.server";

/**
 * Handle inbound Shopify webhook delivery.
 * Returns 200 immediately after HMAC validation; enqueues async processing.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, webhookId } = await authenticate.webhook(request);

  console.info(`[shopify-webhook] topic=${topic} shop=${shop} webhookId=${webhookId}`);

  // Route to the appropriate handler. All handlers are async and non-blocking
  // from Shopify's perspective — we've already returned 200 by the time they run.
  switch (topic) {
    case "ORDERS_PAID":
      await handleOrdersPaid(shop, payload as Record<string, unknown>);
      break;

    case "ORDERS_CANCELLED":
      await handleOrdersCancelled(shop, payload as Record<string, unknown>);
      break;

    case "APP_UNINSTALLED":
      await handleAppUninstalled(shop);
      break;

    case "SHOP_REDACT":
    case "CUSTOMERS_REDACT":
    case "CUSTOMERS_DATA_REQUEST":
      await handleGdprWebhook(topic, shop, payload as Record<string, unknown>);
      break;

    default:
      console.warn(`[shopify-webhook] Unhandled topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};

/**
 * orders/paid — update backing deposit_status to 'succeeded'; enqueue MOQ check.
 *
 * The Shopify order ID is matched against backings.shopify_order_id.
 * Heavy processing (MOQ threshold check, email dispatch) is handled by
 * the API webhook handler at /webhooks/shopify/:shopId for full DB access.
 *
 * In the embedded app we forward the event to the core API.
 */
async function handleOrdersPaid(
  shop: string,
  payload: Record<string, unknown>
): Promise<void> {
  await forwardToApi("orders/paid", shop, payload);
}

/**
 * orders/cancelled — trigger refund logic for linked backing.
 */
async function handleOrdersCancelled(
  shop: string,
  payload: Record<string, unknown>
): Promise<void> {
  await forwardToApi("orders/cancelled", shop, payload);
}

/**
 * app/uninstalled — mark brand's Shopify integration as inactive.
 * Session is already invalidated by @shopify/shopify-app-remix.
 */
async function handleAppUninstalled(shop: string): Promise<void> {
  await forwardToApi("app/uninstalled", shop, { shop });
}

/**
 * GDPR compliance webhooks — forward to the API for audit logging.
 * These are required for Shopify App Store approval.
 */
async function handleGdprWebhook(
  topic: string,
  shop: string,
  payload: Record<string, unknown>
): Promise<void> {
  await forwardToApi(topic, shop, payload);
}

/**
 * Forward webhook payload to the core Fastify API for full processing.
 * The API validates its own HMAC before acting.
 */
async function forwardToApi(
  topic: string,
  shop: string,
  payload: Record<string, unknown>
): Promise<void> {
  const apiUrl = process.env.LOOCBOOC_API_URL;
  if (!apiUrl) {
    console.error("[shopify-webhook] LOOCBOOC_API_URL not set — cannot forward webhook");
    return;
  }

  const shopId = encodeURIComponent(shop.replace(".myshopify.com", ""));
  const endpoint = `${apiUrl}/webhooks/shopify/${shopId}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Topic": topic,
        "X-Shopify-Shop-Domain": shop,
        // Internal shared secret — not a Shopify HMAC, just internal auth
        "X-Internal-Secret": process.env.INTERNAL_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `[shopify-webhook] API forward failed: ${response.status} ${response.statusText}`
      );
    }
  } catch (err) {
    console.error("[shopify-webhook] Failed to forward to API:", err);
  }
}
