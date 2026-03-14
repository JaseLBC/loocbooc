/**
 * Shopify sync worker — processes Shopify webhook payloads asynchronously.
 *
 * Topics handled:
 * - orders/create    → Create or update backing record
 * - orders/paid      → Confirm deposit payment
 * - orders/cancelled → Trigger refund flow for linked backing
 * - app/uninstalled  → Revoke tokens, archive brand's Shopify integration
 * - products/delete  → Archive linked campaign
 */

import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../../../../packages/database/src/client";

interface ShopifyJobData {
  shopId: string;
  topic: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export const shopifySyncWorker = new Worker(
  "shopify-sync",
  async (job) => {
    const { shopId, topic, payload } = job.data as ShopifyJobData;
    job.log(`Processing Shopify webhook: ${topic} for shop ${shopId}`);

    switch (topic) {
      case "orders/create":
        await handleOrderCreate(shopId, payload);
        break;
      case "orders/paid":
        await handleOrderPaid(shopId, payload);
        break;
      case "orders/cancelled":
        await handleOrderCancelled(shopId, payload);
        break;
      case "app/uninstalled":
        await handleAppUninstalled(shopId);
        break;
      case "products/delete":
        await handleProductDelete(payload);
        break;
      default:
        job.log(`Unhandled Shopify topic: ${topic} — ignoring`);
    }

    return { processed: true, topic };
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

/**
 * orders/create — Check if this order contains a Back It product.
 * If so, create a backing record or update an existing pending one.
 */
async function handleOrderCreate(shopId: string, payload: Record<string, unknown>): Promise<void> {
  const shopifyOrderId = String(payload["id"] ?? "");
  if (!shopifyOrderId) return;

  // Find the brand by shopId
  const brand = await prisma.brand.findFirst({
    where: { shopifyStoreUrl: { contains: shopId } },
    select: { id: true },
  });
  if (!brand) return;

  // Check if any line items link to a Back It campaign
  const lineItems = (payload["line_items"] as Array<Record<string, unknown>>) ?? [];
  for (const lineItem of lineItems) {
    const productId = String(lineItem["product_id"] ?? "");

    const campaign = await prisma.campaign.findFirst({
      where: { shopifyProductId: productId },
      select: { id: true, status: true },
    });

    if (campaign && campaign.status === "active") {
      // Record Shopify order association on the pending backing
      await prisma.backing.updateMany({
        where: {
          campaignId: campaign.id,
          shopifyOrderId: null,
          status: "active",
        },
        data: {
          shopifyOrderId: shopifyOrderId,
          shopifyLineItemId: String(lineItem["id"] ?? ""),
        },
      });
    }
  }
}

/**
 * orders/paid — Confirm deposit payment for a backing placed via Shopify checkout.
 */
async function handleOrderPaid(shopId: string, payload: Record<string, unknown>): Promise<void> {
  const shopifyOrderId = String(payload["id"] ?? "");
  if (!shopifyOrderId) return;

  // Update the backing's deposit status to succeeded
  const updated = await prisma.backing.updateMany({
    where: { shopifyOrderId, depositStatus: "pending" },
    data: { depositStatus: "succeeded" },
  });

  if (updated.count > 0) {
    // Trigger MOQ check for the associated campaign
    const backing = await prisma.backing.findFirst({
      where: { shopifyOrderId },
      select: { campaignId: true },
    });

    if (backing) {
      const { moqThresholdQueue } = await import("../queues/queues");
      await moqThresholdQueue.add("check-moq-threshold", {
        campaignId: backing.campaignId,
      });
    }
  }
}

/**
 * orders/cancelled — Trigger refund for the linked backing.
 */
async function handleOrderCancelled(_shopId: string, payload: Record<string, unknown>): Promise<void> {
  const shopifyOrderId = String(payload["id"] ?? "");
  if (!shopifyOrderId) return;

  const backing = await prisma.backing.findFirst({
    where: { shopifyOrderId, status: "active" },
    select: { id: true, campaignId: true },
  });

  if (backing) {
    const { emailNotificationQueue } = await import("../queues/queues");
    await emailNotificationQueue.add("process-backing-refund", {
      backingId: backing.id,
      reason: "shopify_order_cancelled",
    });
  }
}

/**
 * app/uninstalled — Revoke access token, archive brand's Shopify integration.
 */
async function handleAppUninstalled(shopId: string): Promise<void> {
  await prisma.brand.updateMany({
    where: { shopifyStoreUrl: { contains: shopId } },
    data: {
      shopifyAccessToken: null, // Revoke stored token
    },
  });
  console.warn(`[shopify-sync] App uninstalled for shop ${shopId} — access token revoked`);
}

/**
 * products/delete — Archive any campaigns linked to this Shopify product.
 */
async function handleProductDelete(payload: Record<string, unknown>): Promise<void> {
  const productId = String(payload["id"] ?? "");
  if (!productId) return;

  await prisma.campaign.updateMany({
    where: { shopifyProductId: productId, status: { in: ["draft", "scheduled"] } },
    data: { status: "cancelled" },
  });
}

shopifySyncWorker.on("failed", (job, err) => {
  console.error(`[shopify-sync] Job ${job?.id} failed:`, err.message);
});
