/**
 * Shopify Sync Service
 * =====================
 * Handles all Shopify Admin API interactions for the Back It module.
 *
 * Responsibilities:
 *   1. Create draft orders in Shopify when a customer backs a campaign
 *   2. Sync product data (title, price, images) from Shopify to campaigns
 *   3. Convert draft orders to real orders when MOQ is hit
 *
 * All Shopify API calls use exponential backoff retry via the `retryWithBackoff`
 * helper. Shopify's rate limit is 2 requests/second (leaky bucket — 40 burst).
 * On 429 responses, Shopify returns a `Retry-After` header; we honour it.
 *
 * No secrets are hardcoded. All credentials come from environment variables
 * or the brand's encrypted `shopify_access_token` from the database.
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shopify GraphQL Admin API version. */
const SHOPIFY_API_VERSION = "2024-01";

interface ShopifyClient {
  shopDomain: string;
  accessToken: string;
}

interface ShopifyProductVariant {
  id: string;
  title: string;
  price: string;
  sku: string;
  inventoryQuantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
  image: { url: string; altText: string | null } | null;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  featuredImage: { url: string; altText: string | null } | null;
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: ShopifyProductVariant }> };
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
}

interface ShopifyDraftOrderInput {
  customerId?: string;
  email?: string;
  lineItems: Array<{
    variantId: string;
    quantity: number;
    customAttributes?: Array<{ key: string; value: string }>;
  }>;
  shippingAddress: ShopifyMailingAddress;
  note?: string;
  customAttributes?: Array<{ key: string; value: string }>;
  tags?: string[];
}

interface ShopifyMailingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone?: string;
}

interface ShopifyDraftOrder {
  id: string;
  legacyResourceId: string;
  status: string;
  invoiceUrl: string;
  totalPrice: string;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        variantId: string;
        quantity: number;
      };
    }>;
  };
}

interface CreateDraftOrderResult {
  shopifyDraftOrderId: string;
  shopifyDraftOrderLegacyId: string;
  invoiceUrl: string;
  totalPrice: string;
}

interface SyncProductResult {
  shopifyProductId: string;
  title: string;
  descriptionHtml: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  variants: Array<{
    shopifyVariantId: string;
    title: string;
    price: number; // cents
    sku: string;
    size: string;
  }>;
  minPriceCents: number;
  maxPriceCents: number;
  currency: string;
}

interface CompleteOrderResult {
  shopifyOrderId: string;
  shopifyOrderLegacyId: string;
  confirmed: boolean;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create a Shopify client configuration.
 * The access token must be decrypted before passing to this function.
 *
 * @param shopDomain  - The .myshopify.com domain (e.g. "charcoal-online.myshopify.com")
 * @param accessToken - The brand's decrypted Shopify access token
 * @returns ShopifyClient
 */
export function createShopifyClient(
  shopDomain: string,
  accessToken: string
): ShopifyClient {
  return { shopDomain, accessToken };
}

// ---------------------------------------------------------------------------
// Create Draft Order
// ---------------------------------------------------------------------------

/**
 * Create a Shopify draft order when a customer backs a campaign.
 *
 * A draft order reserves the item in Shopify's fulfilment system before
 * the campaign hits MOQ. Draft orders are converted to real orders when
 * the campaign funds (see `completeOrderOnMOQ`).
 *
 * Back It line items have `inventory_management = null` on the product
 * (pre-production inventory doesn't exist), so quantity validation is skipped.
 *
 * @param client        - Shopify client configuration
 * @param backingId     - Loocbooc backing ID (stored as a custom attribute)
 * @param campaignId    - Loocbooc campaign ID
 * @param variantId     - Shopify variant GID (e.g. "gid://shopify/ProductVariant/12345")
 * @param shippingAddress - Backer's shipping address
 * @param customerEmail - Backer's email address
 * @returns Draft order creation result
 */
export async function createDraftOrderForBacking(
  client: ShopifyClient,
  backingId: string,
  campaignId: string,
  variantId: string,
  shippingAddress: ShopifyMailingAddress,
  customerEmail: string
): Promise<CreateDraftOrderResult> {
  const input: ShopifyDraftOrderInput = {
    email: customerEmail,
    lineItems: [
      {
        variantId,
        quantity: 1,
        customAttributes: [
          { key: "_loocbooc_backing_id", value: backingId },
          { key: "_loocbooc_campaign_id", value: campaignId },
        ],
      },
    ],
    shippingAddress,
    note: `Loocbooc Back It — Campaign ${campaignId}`,
    customAttributes: [
      { key: "_loocbooc_backing_id", value: backingId },
      { key: "_loocbooc_campaign_id", value: campaignId },
      { key: "_order_type", value: "back_it" },
    ],
    tags: ["back-it", `campaign-${campaignId}`],
  };

  const mutation = /* graphql */ `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          legacyResourceId
          status
          invoiceUrl
          totalPrice
          lineItems(first: 10) {
            edges {
              node {
                id
                variantId: variant { id }
                quantity
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL<{
    draftOrderCreate: {
      draftOrder: ShopifyDraftOrder | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(client, mutation, { input });

  const { draftOrder, userErrors } = result.draftOrderCreate;

  if (userErrors.length > 0) {
    const messages = userErrors.map((e) => `${e.field.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Shopify draft order creation failed: ${messages}`);
  }

  if (!draftOrder) {
    throw new Error("Shopify draft order creation returned no data");
  }

  return {
    shopifyDraftOrderId: draftOrder.id,
    shopifyDraftOrderLegacyId: draftOrder.legacyResourceId,
    invoiceUrl: draftOrder.invoiceUrl,
    totalPrice: draftOrder.totalPrice,
  };
}

// ---------------------------------------------------------------------------
// Sync product data
// ---------------------------------------------------------------------------

/**
 * Sync product metadata from Shopify to a Back It campaign.
 *
 * Pulls title, description, images, and variant data from the Shopify
 * product and returns it in a normalised format ready to upsert into
 * the Loocbooc campaign record.
 *
 * @param client          - Shopify client configuration
 * @param shopifyProductId - Shopify product GID or legacy numeric ID
 * @returns Normalised product data
 */
export async function syncProductFromShopify(
  client: ShopifyClient,
  shopifyProductId: string
): Promise<SyncProductResult> {
  // Normalise to GID format
  const productGid = shopifyProductId.startsWith("gid://")
    ? shopifyProductId
    : `gid://shopify/Product/${shopifyProductId}`;

  const query = /* graphql */ `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        descriptionHtml
        handle
        featuredImage {
          url
          altText
        }
        images(first: 20) {
          edges {
            node {
              url
              altText
            }
          }
        }
        variants(first: 50) {
          edges {
            node {
              id
              title
              price
              sku
              inventoryQuantity
              selectedOptions {
                name
                value
              }
              image {
                url
                altText
              }
            }
          }
        }
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
      }
    }
  `;

  const result = await shopifyGraphQL<{ product: ShopifyProduct | null }>(
    client,
    query,
    { id: productGid }
  );

  const product = result.product;

  if (!product) {
    throw new Error(`Shopify product not found: ${shopifyProductId}`);
  }

  const galleryUrls = product.images.edges.map((e) => e.node.url);
  const coverImageUrl = product.featuredImage?.url ?? galleryUrls[0] ?? null;

  const variants = product.variants.edges.map(({ node }) => {
    const sizeOption = node.selectedOptions.find(
      (opt) => opt.name.toLowerCase() === "size"
    );
    const priceFloat = parseFloat(node.price);
    return {
      shopifyVariantId: node.id,
      title: node.title,
      price: Math.round(priceFloat * 100), // cents
      sku: node.sku,
      size: sizeOption?.value ?? node.title,
    };
  });

  const minPrice = parseFloat(product.priceRange.minVariantPrice.amount);
  const maxPrice = parseFloat(product.priceRange.maxVariantPrice.amount);

  return {
    shopifyProductId: product.id,
    title: product.title,
    descriptionHtml: product.description,
    coverImageUrl,
    galleryUrls,
    variants,
    minPriceCents: Math.round(minPrice * 100),
    maxPriceCents: Math.round(maxPrice * 100),
    currency: product.priceRange.minVariantPrice.currencyCode,
  };
}

// ---------------------------------------------------------------------------
// Complete order on MOQ hit
// ---------------------------------------------------------------------------

/**
 * Convert a draft order to a confirmed order when the campaign hits MOQ.
 *
 * This is the "complete order" flow. When a campaign reaches its MOQ:
 * 1. All draft orders for the campaign are completed
 * 2. Shopify sends the orders to the fulfilment pipeline
 * 3. The brand (or manufacturer) can then fulfil them in bulk
 *
 * @param client           - Shopify client configuration
 * @param draftOrderId     - Shopify draft order GID
 * @param paymentPending   - If true, complete with `paymentPending: true`
 *                           (payment already captured outside Shopify)
 * @returns Order completion result
 */
export async function completeOrderOnMOQ(
  client: ShopifyClient,
  draftOrderId: string,
  paymentPending: boolean = false
): Promise<CompleteOrderResult> {
  const mutation = /* graphql */ `
    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          order {
            id
            legacyResourceId
            confirmed
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL<{
    draftOrderComplete: {
      draftOrder: {
        order: {
          id: string;
          legacyResourceId: string;
          confirmed: boolean;
        } | null;
      } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(client, mutation, { id: draftOrderId, paymentPending });

  const { draftOrder, userErrors } = result.draftOrderComplete;

  if (userErrors.length > 0) {
    const messages = userErrors.map((e) => `${e.field.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Shopify draft order completion failed: ${messages}`);
  }

  const order = draftOrder?.order;

  if (!order) {
    throw new Error(`Draft order ${draftOrderId} has no linked order after completion`);
  }

  return {
    shopifyOrderId: order.id,
    shopifyOrderLegacyId: order.legacyResourceId,
    confirmed: order.confirmed,
  };
}

// ---------------------------------------------------------------------------
// Register webhooks
// ---------------------------------------------------------------------------

/**
 * Register all required Shopify webhooks for a newly installed store.
 *
 * Called as part of the OAuth `afterAuth` hook. Idempotent — Shopify
 * deduplicates webhooks by topic + address.
 *
 * @param client  - Shopify client configuration
 * @param appUrl  - The public URL of the Loocbooc app (for webhook delivery)
 */
export async function registerShopifyWebhooks(
  client: ShopifyClient,
  appUrl: string
): Promise<void> {
  const callbackUrl = `${appUrl}/webhooks/shopify/${client.shopDomain.replace(".myshopify.com", "")}`;

  const topics = [
    "ORDERS_PAID",
    "ORDERS_CANCELLED",
    "APP_UNINSTALLED",
    "SHOP_REDACT",
    "CUSTOMERS_REDACT",
    "CUSTOMERS_DATA_REQUEST",
  ];

  for (const topic of topics) {
    await retryWithBackoff(async () => {
      const mutation = /* graphql */ `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription { id }
            userErrors { field message }
          }
        }
      `;

      await shopifyGraphQL(client, mutation, {
        topic,
        webhookSubscription: {
          callbackUrl,
          format: "JSON",
        },
      });
    });
  }
}

// ---------------------------------------------------------------------------
// GraphQL executor with retry
// ---------------------------------------------------------------------------

/**
 * Execute a Shopify Admin GraphQL request.
 *
 * Handles authentication, rate limiting, and serialises the response.
 * Throws on non-2xx HTTP responses or GraphQL errors.
 *
 * @param client    - Shopify client (shop domain + access token)
 * @param query     - GraphQL query or mutation string
 * @param variables - GraphQL variables
 * @returns Parsed GraphQL `data` field
 */
async function shopifyGraphQL<T>(
  client: ShopifyClient,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = `https://${client.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  return retryWithBackoff(async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": client.accessToken,
        "User-Agent": "Loocbooc/1.0 (+https://loocbooc.com)",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter ? parseFloat(retryAfter) * 1000 : 2000;
      await sleep(delayMs);
      throw new ShopifyRateLimitError(`Rate limited by Shopify (retry after ${delayMs}ms)`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Shopify GraphQL HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };

    if (json.errors?.length) {
      const messages = json.errors.map((e) => e.message).join("; ");
      throw new Error(`Shopify GraphQL errors: ${messages}`);
    }

    if (!json.data) {
      throw new Error("Shopify GraphQL response missing data field");
    }

    return json.data;
  });
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

/** Marker class for rate limit errors — triggers retry. */
class ShopifyRateLimitError extends Error {
  readonly isRateLimit = true;
}

/**
 * Execute an async function with exponential backoff retry.
 *
 * Retries on:
 *   - Network errors
 *   - Shopify rate limit errors (429, ShopifyRateLimitError)
 *   - Transient 5xx errors
 *
 * Does NOT retry on:
 *   - GraphQL user errors (these are permanent)
 *   - 401/403 (auth failures — retrying won't help)
 *   - 404 (resource not found)
 *
 * @param fn        - The async function to execute
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns The result of the function
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isRetryable =
        err instanceof ShopifyRateLimitError ||
        (err instanceof Error && isTransientError(err.message));

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      const baseDelay = 1000; // 1 second
      const jitter = Math.random() * 500;
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, 30_000);

      console.warn(
        `[shopify-sync] Retryable error (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}. Retrying in ${Math.round(delay)}ms…`
      );

      await sleep(delay);
    }
  }

  throw lastError ?? new Error("retryWithBackoff: unexpected exit");
}

/**
 * Determine whether an error message indicates a transient failure.
 * @param message - Error message string
 */
function isTransientError(message: string): boolean {
  const transientPatterns = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "network",
    "fetch failed",
    "503",
    "502",
    "500",
    "rate limit",
  ];
  const lower = message.toLowerCase();
  return transientPatterns.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Promisified sleep.
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Access token encryption helpers
// ---------------------------------------------------------------------------

/**
 * Encrypt a Shopify access token for database storage.
 *
 * Uses AES-256-GCM with a random IV. The SHOPIFY_TOKEN_ENCRYPTION_KEY
 * environment variable must be a 32-byte hex string (256 bits).
 *
 * @param plaintext - The raw Shopify access token
 * @returns Base64-encoded ciphertext (iv:authTag:ciphertext)
 */
export function encryptAccessToken(plaintext: string): string {
  const keyHex = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Encode as iv:authTag:ciphertext (all Base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a Shopify access token retrieved from the database.
 *
 * @param ciphertext - Base64-encoded ciphertext (iv:authTag:ciphertext)
 * @returns The decrypted access token string
 */
export function decryptAccessToken(ciphertext: string): string {
  const keyHex = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const ivB64 = parts[0]!;
  const authTagB64 = parts[1]!;
  const encryptedB64 = parts[2]!;
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
