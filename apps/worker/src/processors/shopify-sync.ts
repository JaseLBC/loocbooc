/**
 * Shopify sync worker — processes Shopify webhook payloads asynchronously.
 *
 * Topics handled:
 * - orders/create    → Create or update backing record
 * - orders/paid      → Confirm deposit payment
 * - orders/cancelled → Trigger refund flow for linked backing
 * - app/uninstalled  → Revoke tokens, archive brand's Shopify integration
 * - products/delete  → Archive linked campaign
 *
 * GDPR compliance (required for Shopify App Store):
 * - gdpr.shop-redact          → Delete all shop data 48h after uninstall
 * - gdpr.customer-redact      → Anonymise customer PII on request
 * - gdpr.customer-data-request → Export customer data on request
 */

import { Worker, type ConnectionOptions } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "@loocbooc/database";

interface ShopifyJobData {
  shopId?: string;
  topic?: string;
  payload?: Record<string, unknown>;
  receivedAt?: string;
  // GDPR fields
  shopDomain?: string;
  customerId?: number;
  customerEmail?: string;
  shopifyOrderIds?: number[];
  dataRequestId?: number;
  requestedAt?: string;
}

export const shopifySyncWorker = new Worker(
  "shopify-sync",
  async (job) => {
    const data = job.data as ShopifyJobData;
    const jobName = job.name;

    // Handle GDPR jobs (prefixed with gdpr.)
    if (jobName.startsWith("gdpr.")) {
      job.log(`Processing GDPR job: ${jobName}`);
      switch (jobName) {
        case "gdpr.shop-redact":
          await handleShopRedact(data.shopDomain ?? "");
          break;
        case "gdpr.customer-redact":
          await handleCustomerRedact(data);
          break;
        case "gdpr.customer-data-request":
          await handleCustomerDataRequest(data);
          break;
        default:
          job.log(`Unknown GDPR job type: ${jobName}`);
      }
      return { processed: true, type: "gdpr", jobName };
    }

    // Handle standard Shopify webhook jobs
    const { shopId, topic, payload } = data;
    if (!topic) {
      job.log(`Job missing topic field — jobName: ${jobName}`);
      return { processed: false, reason: "missing_topic" };
    }

    job.log(`Processing Shopify webhook: ${topic} for shop ${shopId ?? "unknown"}`);

    switch (topic) {
      case "orders/create":
        await handleOrderCreate(shopId ?? "", payload ?? {});
        break;
      case "orders/paid":
        await handleOrderPaid(shopId ?? "", payload ?? {});
        break;
      case "orders/cancelled":
        await handleOrderCancelled(shopId ?? "", payload ?? {});
        break;
      case "app/uninstalled":
        await handleAppUninstalled(shopId ?? "");
        break;
      case "products/delete":
        await handleProductDelete(payload ?? {});
        break;
      default:
        job.log(`Unhandled Shopify topic: ${topic} — ignoring`);
    }

    return { processed: true, topic };
  },
  {
    connection: redis as unknown as ConnectionOptions,
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

// ─────────────────────────────────────────────
// GDPR HANDLERS (required for Shopify App Store)
// ─────────────────────────────────────────────

/**
 * shop/redact — Delete all data for a shop 48 hours after uninstall.
 * Shopify mandates this for App Store compliance.
 */
async function handleShopRedact(shopDomain: string): Promise<void> {
  if (!shopDomain) return;

  // Find the brand by shop domain
  const brand = await prisma.brand.findFirst({
    where: {
      OR: [
        { shopifyStoreUrl: { contains: shopDomain } },
        { shopifyStoreUrl: { contains: shopDomain.replace(".myshopify.com", "") } },
      ],
    },
    select: { id: true },
  });

  if (!brand) {
    console.warn(`[gdpr.shop-redact] No brand found for ${shopDomain} — may already be deleted`);
    return;
  }

  // Anonymise brand's Shopify connection data — keep the brand record but wipe PII
  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      shopifyStoreUrl: null,
      shopifyAccessToken: null,
    },
  });

  // Clear Shopify-specific order references but keep business records
  await prisma.backing.updateMany({
    where: {
      campaign: { brandId: brand.id },
      shopifyOrderId: { not: null },
    },
    data: {
      shopifyOrderId: "[REDACTED]",
      shopifyLineItemId: null,
    },
  });

  console.warn(`[gdpr.shop-redact] Completed data redaction for ${shopDomain}`);
}

/**
 * customers/redact — Anonymise a specific customer's PII.
 * Called when a customer requests erasure via the Shopify store.
 */
async function handleCustomerRedact(data: {
  shopDomain?: string;
  customerId?: number;
  customerEmail?: string;
  shopifyOrderIds?: number[];
}): Promise<void> {
  const { customerEmail, shopifyOrderIds } = data;

  if (!customerEmail && (!shopifyOrderIds || shopifyOrderIds.length === 0)) {
    console.warn("[gdpr.customer-redact] No identifiable customer data provided");
    return;
  }

  // If we have an email, anonymise user records
  if (customerEmail) {
    // Find user by email — may not exist if they never created a Loocbooc account
    const user = await prisma.user.findUnique({
      where: { email: customerEmail },
      select: { id: true },
    });

    if (user) {
      // Anonymise user record — keep the ID for foreign key integrity
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: `redacted+${user.id}@redacted.loocbooc.com`,
          fullName: "[REDACTED]",
          displayName: "[REDACTED]",
          phone: null,
          avatarUrl: null,
          status: "deleted",
        },
      });

      // Anonymise avatar measurements
      await prisma.avatar.updateMany({
        where: { userId: user.id },
        data: {
          nickname: "[REDACTED]",
          height: null,
          weightKg: null,
          bust: null,
          waist: null,
          hips: null,
          inseam: null,
          shoulderWidth: null,
          sleeveLength: null,
          neck: null,
          chest: null,
          thigh: null,
          rise: null,
          bodyShape: null,
          avatar3dUrl: null,
          avatarImgUrl: null,
        },
      });

      console.warn(`[gdpr.customer-redact] Anonymised user ${user.id} (email: ${customerEmail})`);
    }
  }

  // Anonymise specific Shopify orders if provided
  if (shopifyOrderIds && shopifyOrderIds.length > 0) {
    const orderIdStrings = shopifyOrderIds.map(String);
    await prisma.backing.updateMany({
      where: { shopifyOrderId: { in: orderIdStrings } },
      data: {
        shippingAddress: { redacted: true, reason: "GDPR customer request" },
      },
    });
    console.warn(`[gdpr.customer-redact] Anonymised ${shopifyOrderIds.length} Shopify orders`);
  }
}

/**
 * customers/data_request — Export all data for a customer.
 * In production, this would generate a JSON export and email it to the customer.
 * For now, we log the request — actual export requires additional infrastructure.
 */
async function handleCustomerDataRequest(data: {
  shopDomain?: string;
  customerId?: number;
  customerEmail?: string;
  dataRequestId?: number;
}): Promise<void> {
  const { customerEmail, dataRequestId } = data;

  if (!customerEmail) {
    console.warn("[gdpr.customer-data-request] No customer email provided");
    return;
  }

  // Find user data
  const user = await prisma.user.findUnique({
    where: { email: customerEmail },
    include: {
      avatars: true,
      orders: {
        include: { items: true },
        take: 100,
      },
      styleBriefs: {
        take: 100,
      },
    },
  });

  if (!user) {
    console.warn(`[gdpr.customer-data-request] No user found for ${customerEmail}`);
    return;
  }

  // In production: send this data export to the customer via email
  // For now, log that we received and processed the request
  const exportSummary = {
    dataRequestId,
    userId: user.id,
    email: user.email,
    avatarCount: user.avatars.length,
    orderCount: user.orders.length,
    briefCount: user.styleBriefs.length,
    requestProcessedAt: new Date().toISOString(),
  };

  console.warn(`[gdpr.customer-data-request] Data request processed:`, JSON.stringify(exportSummary));

  // TODO: Integrate with email service to send export to customer
  // The email should contain:
  // 1. All user profile data
  // 2. Avatar measurements and fit results
  // 3. Order history
  // 4. Style briefs and lookbook data
  // 5. Taste profile data
}

shopifySyncWorker.on("failed", (job, err) => {
  console.error(`[shopify-sync] Job ${job?.id} failed:`, err.message);
});
