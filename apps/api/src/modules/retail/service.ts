/**
 * Retail Platform — service layer.
 *
 * All database interactions and business logic live here.
 * Routes are thin wrappers that validate input, call these functions, return responses.
 *
 * Key design decisions:
 * - Cart is persistent (DB-backed), one cart per authenticated user
 * - Stock is checked on add-to-cart and again at checkout (TOCTOU guard)
 * - Stripe PaymentIntent is created at checkout with idempotencyKey = orderId
 * - Order is created in "pending" status; confirmed on Stripe webhook
 * - Product slugs are unique platform-wide (not brand-scoped)
 * - All money values are integers (cents) — zero floats
 */

import { prisma, Prisma } from "@loocbooc/database";
import Stripe from "stripe";
import type {
  CreateProductInput,
  UpdateProductInput,
  AddToCartInput,
  UpdateCartItemInput,
  CreateCheckoutSessionInput,
  ConfirmOrderInput,
} from "./schema.js";
import type {
  ProductSummary,
  ProductDetail,
  VariantSummary,
  CartSummary,
  CartItemDetail,
  BrowseProductsQuery,
  BrowseProductsResult,
  CheckoutSessionResult,
  RetailOrderSummary,
  RetailOrderDetail,
  BrandProductStats,
} from "./types.js";

// ─────────────────────────────────────────────
// Service error
// ─────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// ─────────────────────────────────────────────
// Stripe client (lazy init to avoid failures when key not set)
// ─────────────────────────────────────────────

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) throw new ServiceError("CONFIG_ERROR", "Stripe is not configured.", 500);
    // Use the latest Stripe API version supported by our Stripe SDK
    _stripe = new Stripe(key, { apiVersion: "2023-10-16" as Stripe.LatestApiVersion });
  }
  return _stripe;
}

// ─────────────────────────────────────────────
// Shipping rate helper
// ─────────────────────────────────────────────

/**
 * Simple flat-rate shipping based on order destination.
 * In production, replace with a carrier API (Shippit, StarShipIt, etc.)
 */
function calculateShippingCents(country: string, subtotalCents: number): number {
  // Free shipping over AUD $150 for domestic
  if (country === "AU" && subtotalCents >= 15000) return 0;
  if (country === "AU") return 995;    // $9.95 flat rate domestic
  if (["NZ", "SG", "JP", "HK"].includes(country)) return 2500;  // $25 nearby international
  return 4500;  // $45 rest of world
}

/**
 * Calculate GST (10%) for Australian orders.
 * Prices are already GST-inclusive for AU — this computes the GST component.
 */
function calculateTaxCents(country: string, subtotalCents: number): number {
  if (country !== "AU") return 0;  // GST applies to AU only (simplified)
  return Math.round(subtotalCents / 11);  // GST is 1/11 of GST-inclusive price
}

// ─────────────────────────────────────────────
// Product shape helpers
// ─────────────────────────────────────────────

type PrismaProductFull = Awaited<ReturnType<typeof prisma.retailProduct.findUnique>> & {
  brand: { id: string; name: string; slug: string; logoUrl: string | null };
  variants: Array<{
    id: string; sku: string | null; colour: string | null; colourHex: string | null;
    size: string | null; sizeSystem: string | null; priceCents: number;
    comparePriceCents: number | null; stock: number; stockTracked: boolean;
    barcode: string | null; weightGrams: number | null; imageUrl: string | null;
    sortOrder: number; isAvailable: boolean; createdAt: Date; updatedAt: Date;
  }>;
};

function toVariantSummary(v: PrismaProductFull["variants"][number]): VariantSummary {
  return {
    id: v.id,
    sku: v.sku,
    colour: v.colour,
    colourHex: v.colourHex,
    size: v.size,
    sizeSystem: v.sizeSystem,
    priceCents: v.priceCents,
    comparePriceCents: v.comparePriceCents,
    stock: v.stock,
    stockTracked: v.stockTracked,
    isAvailable: v.isAvailable && (v.stockTracked ? v.stock > 0 : true),
    imageUrl: v.imageUrl,
    sortOrder: v.sortOrder,
  };
}

function toProductSummary(p: NonNullable<PrismaProductFull>): ProductSummary {
  const variants = p.variants ?? [];
  const colours = [...new Set(variants.map((v) => v.colour).filter(Boolean) as string[])];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean) as string[])];
  const hasStock = variants.some((v) => v.isAvailable && (!v.stockTracked || v.stock > 0));
  const isOnSale = p.comparePriceCents != null && p.comparePriceCents > p.priceCents;

  return {
    id: p.id,
    brandId: p.brandId,
    brandName: p.brand.name,
    brandSlug: p.brand.slug,
    brandLogoUrl: p.brand.logoUrl,
    name: p.name,
    slug: p.slug,
    category: p.category,
    gender: p.gender,
    tags: p.tags,
    status: p.status,
    priceCents: p.priceCents,
    comparePriceCents: p.comparePriceCents,
    currency: p.currency,
    coverImageUrl: p.coverImageUrl,
    galleryUrls: p.galleryUrls,
    totalSold: p.totalSold,
    colours,
    sizes,
    isOnSale,
    hasStock,
  };
}

function toProductDetail(p: NonNullable<PrismaProductFull>): ProductDetail {
  return {
    ...toProductSummary(p),
    description: p.description,
    season: p.season,
    weightGrams: p.weightGrams,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    variants: (p.variants ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map(toVariantSummary),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const PRODUCT_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
  variants: {
    select: {
      id: true, sku: true, colour: true, colourHex: true, size: true, sizeSystem: true,
      priceCents: true, comparePriceCents: true, stock: true, stockTracked: true,
      barcode: true, weightGrams: true, imageUrl: true, sortOrder: true,
      isAvailable: true, createdAt: true, updatedAt: true,
    },
  },
} as const;

// ─────────────────────────────────────────────
// Brand ownership guard
// ─────────────────────────────────────────────

async function assertBrandMember(userId: string, brandId: string): Promise<void> {
  const member = await prisma.brandMember.findFirst({
    where: { userId, brandId },
    select: { id: true },
  });
  if (!member) {
    throw new ServiceError("FORBIDDEN", "You do not have access to this brand.", 403);
  }
}

// ─────────────────────────────────────────────
// PRODUCT CRUD
// ─────────────────────────────────────────────

/**
 * Create a new retail product for a brand.
 * Validates brand membership, slug uniqueness, and creates all variants.
 */
export async function createProduct(
  userId: string,
  input: CreateProductInput,
): Promise<ProductDetail> {
  await assertBrandMember(userId, input.brandId);

  // Check slug uniqueness
  const existing = await prisma.retailProduct.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) {
    throw new ServiceError("SLUG_TAKEN", `The slug "${input.slug}" is already in use. Choose a different slug.`, 409);
  }

  const product = await prisma.retailProduct.create({
    data: {
      brandId:          input.brandId,
      garmentId:        input.garmentId,
      name:             input.name,
      slug:             input.slug,
      description:      input.description,
      category:         input.category,
      gender:           input.gender,
      season:           input.season,
      tags:             input.tags,
      priceCents:       input.priceCents,
      comparePriceCents: input.comparePriceCents,
      currency:         input.currency,
      coverImageUrl:    input.coverImageUrl,
      galleryUrls:      input.galleryUrls,
      weightGrams:      input.weightGrams,
      metaTitle:        input.metaTitle,
      metaDescription:  input.metaDescription,
      shopifyProductId: input.shopifyProductId,
      status:           "draft",
      variants: {
        create: input.variants.map((v) => ({
          sku:              v.sku,
          colour:           v.colour,
          colourHex:        v.colourHex,
          size:             v.size,
          sizeSystem:       v.sizeSystem,
          priceCents:       v.priceCents,
          comparePriceCents: v.comparePriceCents,
          stock:            v.stock,
          stockTracked:     v.stockTracked,
          barcode:          v.barcode,
          weightGrams:      v.weightGrams,
          imageUrl:         v.imageUrl,
          sortOrder:        v.sortOrder,
          isAvailable:      v.isAvailable,
        })),
      },
    },
    include: PRODUCT_INCLUDE,
  });

  return toProductDetail(product as unknown as NonNullable<PrismaProductFull>);
}

/**
 * Get a product by ID.
 * Includes full variant data.
 */
export async function getProduct(productId: string): Promise<ProductDetail> {
  const product = await prisma.retailProduct.findUnique({
    where: { id: productId },
    include: PRODUCT_INCLUDE,
  });
  if (!product) {
    throw new ServiceError("NOT_FOUND", "Product not found.", 404);
  }
  return toProductDetail(product as unknown as NonNullable<PrismaProductFull>);
}

/**
 * Get a product by slug (public endpoint — used by consumer product pages).
 * Drafts are hidden from the public.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const product = await prisma.retailProduct.findUnique({
    where: { slug },
    include: PRODUCT_INCLUDE,
  });
  if (!product) {
    throw new ServiceError("NOT_FOUND", "Product not found.", 404);
  }
  if (product.status === "draft") {
    throw new ServiceError("NOT_FOUND", "Product not found.", 404);
  }
  return toProductDetail(product as unknown as NonNullable<PrismaProductFull>);
}

/**
 * Update a product.
 * If variants are included, they are upserted (existing variants updated, new ones created).
 * Variants not in the payload are NOT deleted — use deleteVariant for that.
 */
export async function updateProduct(
  productId: string,
  userId: string,
  input: UpdateProductInput,
): Promise<ProductDetail> {
  const product = await prisma.retailProduct.findUnique({
    where: { id: productId },
    select: { id: true, brandId: true, slug: true },
  });
  if (!product) {
    throw new ServiceError("NOT_FOUND", "Product not found.", 404);
  }
  await assertBrandMember(userId, product.brandId);

  // Check slug uniqueness if changing slug
  if (input.slug && input.slug !== product.slug) {
    const existing = await prisma.retailProduct.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ServiceError("SLUG_TAKEN", `The slug "${input.slug}" is already in use.`, 409);
    }
  }

  const { variants: variantUpdates, ...productData } = input;

  // Update product and upsert variants in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.retailProduct.update({
      where: { id: productId },
      data: productData,
      include: PRODUCT_INCLUDE,
    });

    if (variantUpdates && variantUpdates.length > 0) {
      for (const v of variantUpdates) {
        if (v.id) {
          // Update existing variant
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              sku: v.sku,
              colour: v.colour,
              colourHex: v.colourHex,
              size: v.size,
              sizeSystem: v.sizeSystem,
              priceCents: v.priceCents,
              comparePriceCents: v.comparePriceCents,
              stock: v.stock,
              stockTracked: v.stockTracked,
              barcode: v.barcode,
              weightGrams: v.weightGrams,
              imageUrl: v.imageUrl,
              sortOrder: v.sortOrder,
              isAvailable: v.isAvailable,
            },
          });
        } else {
          // Create new variant
          await tx.productVariant.create({
            data: {
              productId,
              sku: v.sku,
              colour: v.colour,
              colourHex: v.colourHex,
              size: v.size,
              sizeSystem: v.sizeSystem,
              priceCents: v.priceCents,
              comparePriceCents: v.comparePriceCents,
              stock: v.stock ?? 0,
              stockTracked: v.stockTracked ?? true,
              barcode: v.barcode,
              weightGrams: v.weightGrams,
              imageUrl: v.imageUrl,
              sortOrder: v.sortOrder ?? 0,
              isAvailable: v.isAvailable ?? true,
            },
          });
        }
      }
      // Re-fetch with updated variants
      return tx.retailProduct.findUnique({
        where: { id: productId },
        include: PRODUCT_INCLUDE,
      });
    }

    return p;
  });

  return toProductDetail(updated as unknown as NonNullable<PrismaProductFull>);
}

/**
 * Publish a product (draft → active).
 */
export async function publishProduct(productId: string, userId: string): Promise<ProductDetail> {
  const product = await prisma.retailProduct.findUnique({
    where: { id: productId },
    select: { id: true, brandId: true, status: true },
  });
  if (!product) throw new ServiceError("NOT_FOUND", "Product not found.", 404);
  await assertBrandMember(userId, product.brandId);

  if (product.status === "active") {
    throw new ServiceError("ALREADY_ACTIVE", "Product is already active.", 400);
  }

  const updated = await prisma.retailProduct.update({
    where: { id: productId },
    data: { status: "active" },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(updated as unknown as NonNullable<PrismaProductFull>);
}

/**
 * Archive a product.
 */
export async function archiveProduct(productId: string, userId: string): Promise<ProductDetail> {
  const product = await prisma.retailProduct.findUnique({
    where: { id: productId },
    select: { id: true, brandId: true },
  });
  if (!product) throw new ServiceError("NOT_FOUND", "Product not found.", 404);
  await assertBrandMember(userId, product.brandId);

  const updated = await prisma.retailProduct.update({
    where: { id: productId },
    data: { status: "archived" },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(updated as unknown as NonNullable<PrismaProductFull>);
}

/**
 * List all products for a brand (brand dashboard view — includes drafts).
 */
export async function listBrandProducts(
  brandId: string,
  userId: string,
  opts: { limit: number; offset: number; status?: string; search?: string },
): Promise<{ data: ProductDetail[]; total: number }> {
  await assertBrandMember(userId, brandId);

  const where = {
    brandId,
    ...(opts.status ? { status: opts.status as "draft" | "active" | "archived" | "out_of_stock" } : {}),
    ...(opts.search ? {
      OR: [
        { name: { contains: opts.search, mode: "insensitive" as const } },
        { description: { contains: opts.search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.retailProduct.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: opts.offset,
      take: opts.limit,
    }),
    prisma.retailProduct.count({ where }),
  ]);

  return {
    data: products.map((p) => toProductDetail(p as unknown as NonNullable<PrismaProductFull>)),
    total,
  };
}

/**
 * Get brand product stats for the dashboard header.
 */
export async function getBrandProductStats(brandId: string, userId: string): Promise<BrandProductStats> {
  await assertBrandMember(userId, brandId);

  const [counts, revenueResult, lowStockCount] = await Promise.all([
    prisma.retailProduct.groupBy({
      by: ["status"],
      where: { brandId },
      _count: { id: true },
    }),
    prisma.retailProduct.aggregate({
      where: { brandId },
      _sum: { totalRevenueCents: true, totalSold: true },
    }),
    prisma.productVariant.count({
      where: {
        product: { brandId },
        stockTracked: true,
        stock: { lte: 3 },
        isAvailable: true,
      },
    }),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));

  return {
    totalProducts: Object.values(countMap).reduce((s, v) => s + v, 0),
    activeProducts: countMap["active"] ?? 0,
    draftProducts: countMap["draft"] ?? 0,
    totalRevenueCents: revenueResult._sum.totalRevenueCents ?? 0,
    totalUnitsSold: revenueResult._sum.totalSold ?? 0,
    lowStockVariants: lowStockCount,
  };
}

// ─────────────────────────────────────────────
// PUBLIC BROWSE
// ─────────────────────────────────────────────

/**
 * Browse active retail products — public, no auth required.
 * Supports filtering by brand, category, gender, price, search, and sort.
 */
export async function browseProducts(query: BrowseProductsQuery): Promise<BrowseProductsResult> {
  const {
    brandId, category, gender, search, minPriceCents, maxPriceCents, sort, limit, offset,
  } = query;

  const where: Prisma.RetailProductWhereInput = {
    status: "active",
    ...(brandId ? { brandId } : {}),
    ...(category ? { category: { equals: category, mode: "insensitive" as const } } : {}),
    ...(gender ? { gender } : {}),
    ...(minPriceCents != null || maxPriceCents != null ? {
      priceCents: {
        ...(minPriceCents != null ? { gte: minPriceCents } : {}),
        ...(maxPriceCents != null ? { lte: maxPriceCents } : {}),
      },
    } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
        { tags: { has: search.toLowerCase() } },
      ],
    } : {}),
  };

  const orderBy: Prisma.RetailProductOrderByWithRelationInput =
    sort === "price_asc"    ? { priceCents: "asc" }  :
    sort === "price_desc"   ? { priceCents: "desc" } :
    sort === "best_selling" ? { totalSold: "desc" }  :
    { createdAt: "desc" };

  const [products, total] = await Promise.all([
    prisma.retailProduct.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy,
      skip: offset,
      take: limit,
    }),
    prisma.retailProduct.count({ where }),
  ]);

  return {
    data: products.map((p) => toProductSummary(p as unknown as NonNullable<PrismaProductFull>)),
    total,
    hasMore: offset + limit < total,
    limit,
    offset,
  };
}

// ─────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────

/**
 * Get or create a cart for an authenticated user.
 */
export async function getOrCreateCart(userId: string): Promise<CartSummary> {
  let cart = await prisma.cart.findFirst({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: { brand: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { brand: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });
  }

  return buildCartSummary(cart);
}

/**
 * Add an item to the cart. If the variant is already in cart, increment quantity.
 */
export async function addToCart(userId: string, input: AddToCartInput): Promise<CartSummary> {
  // Validate variant exists and has stock
  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: { select: { status: true } } },
  });
  if (!variant) {
    throw new ServiceError("VARIANT_NOT_FOUND", "Product variant not found.", 404);
  }
  if (variant.product.status !== "active") {
    throw new ServiceError("PRODUCT_NOT_ACTIVE", "This product is not available for purchase.", 400);
  }
  if (!variant.isAvailable) {
    throw new ServiceError("VARIANT_UNAVAILABLE", "This variant is not available.", 400);
  }
  if (variant.stockTracked && variant.stock < input.quantity) {
    throw new ServiceError(
      "INSUFFICIENT_STOCK",
      `Only ${variant.stock} unit${variant.stock === 1 ? "" : "s"} available.`,
      400,
      { available: variant.stock, requested: input.quantity },
    );
  }

  // Get or create cart
  let cart = await prisma.cart.findFirst({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }

  // Upsert cart item (increment qty if already in cart)
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: input.variantId } },
  });

  if (existingItem) {
    const newQty = existingItem.quantity + input.quantity;
    if (variant.stockTracked && variant.stock < newQty) {
      throw new ServiceError(
        "INSUFFICIENT_STOCK",
        `Only ${variant.stock} unit${variant.stock === 1 ? "" : "s"} available in total.`,
        400,
        { available: variant.stock, requested: newQty },
      );
    }
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId: input.variantId, quantity: input.quantity },
    });
  }

  // Return updated cart
  return getOrCreateCart(userId);
}

/**
 * Update quantity of a cart item. quantity=0 removes the item.
 */
export async function updateCartItem(
  userId: string,
  cartItemId: string,
  input: UpdateCartItemInput,
): Promise<CartSummary> {
  // Verify the cart item belongs to this user
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      cart: { select: { userId: true } },
      variant: { select: { stock: true, stockTracked: true } },
    },
  });
  if (!item || item.cart.userId !== userId) {
    throw new ServiceError("NOT_FOUND", "Cart item not found.", 404);
  }

  if (input.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: cartItemId } });
  } else {
    if (item.variant.stockTracked && item.variant.stock < input.quantity) {
      throw new ServiceError(
        "INSUFFICIENT_STOCK",
        `Only ${item.variant.stock} unit${item.variant.stock === 1 ? "" : "s"} available.`,
        400,
      );
    }
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: input.quantity },
    });
  }

  return getOrCreateCart(userId);
}

/**
 * Clear all items from the user's cart.
 */
export async function clearCart(userId: string): Promise<void> {
  const cart = await prisma.cart.findFirst({ where: { userId } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

/**
 * Build a CartSummary from a Prisma cart with items+variants included.
 */
function buildCartSummary(cart: {
  id: string;
  currency: string;
  items: Array<{
    id: string;
    quantity: number;
    variant: {
      id: string;
      priceCents: number;
      colour: string | null;
      size: string | null;
      stock: number;
      stockTracked: boolean;
      isAvailable: boolean;
      product: {
        id: string;
        name: string;
        slug: string;
        coverImageUrl: string | null;
        currency: string;
        brand: { name: string };
      };
    };
  }>;
}): CartSummary {
  const items: CartItemDetail[] = cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      coverImageUrl: p.coverImageUrl,
      brandName: p.brand.name,
      colour: v.colour,
      size: v.size,
      quantity: item.quantity,
      unitPriceCents: v.priceCents,
      totalCents: v.priceCents * item.quantity,
      currency: p.currency,
      isAvailable: v.isAvailable && (!v.stockTracked || v.stock >= item.quantity),
      stock: v.stock,
    };
  });

  const subtotalCents = items.reduce((s, i) => s + i.totalCents, 0);
  // Shipping/tax calculated per-checkout using shippingAddress — show estimates here
  const estimatedShippingCents = 0;  // shown as "Calculated at checkout"
  const estimatedTaxCents = 0;

  return {
    id: cart.id,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotalCents,
    currency: cart.currency,
    estimatedShippingCents,
    estimatedTaxCents,
    estimatedTotalCents: subtotalCents + estimatedShippingCents + estimatedTaxCents,
  };
}

// ─────────────────────────────────────────────
// CHECKOUT
// ─────────────────────────────────────────────

/**
 * Create a checkout session — validates cart, calculates totals,
 * creates a RetailOrder in "pending" status, creates a Stripe PaymentIntent.
 * Returns the clientSecret to mount the Stripe Payment Element.
 */
export async function createCheckoutSession(
  userId: string,
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  // 1. Fetch and validate the cart
  const cart = await prisma.cart.findUnique({
    where: { id: input.cartId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { brandId: true, name: true, status: true, currency: true } },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.userId !== userId) {
    throw new ServiceError("CART_NOT_FOUND", "Cart not found.", 404);
  }
  if (cart.items.length === 0) {
    throw new ServiceError("CART_EMPTY", "Your cart is empty.", 400);
  }

  // 2. Verify all items are still available and have stock (TOCTOU guard)
  const stockErrors: string[] = [];
  for (const item of cart.items) {
    const v = item.variant;
    if (v.product.status !== "active") {
      stockErrors.push(`${v.product.name} is no longer available.`);
    } else if (!v.isAvailable) {
      stockErrors.push(`${v.product.name} — ${v.colour ?? ""} ${v.size ?? ""} is sold out.`);
    } else if (v.stockTracked && v.stock < item.quantity) {
      stockErrors.push(`${v.product.name} — only ${v.stock} left in stock (you have ${item.quantity} in cart).`);
    }
  }
  if (stockErrors.length > 0) {
    throw new ServiceError("STOCK_ERRORS", "Some items in your cart are unavailable.", 400, { errors: stockErrors });
  }

  // 3. Determine the brand (for now, single-brand cart — first item's brand)
  const brandId = cart.items[0]!.variant.product.brandId;
  const currency = cart.items[0]!.variant.product.currency;

  // 4. Calculate totals
  const subtotalCents = cart.items.reduce(
    (s, i) => s + i.variant.priceCents * i.quantity,
    0,
  );
  const shippingCents = calculateShippingCents(input.shippingAddress.country, subtotalCents);
  const taxCents = calculateTaxCents(input.shippingAddress.country, subtotalCents);
  const totalCents = subtotalCents + shippingCents + taxCents;

  // 5. Create the order (pending)
  const order = await prisma.retailOrder.create({
    data: {
      userId,
      brandId,
      status: "pending",
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      currency,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress ?? input.shippingAddress,
      notes: input.notes,
      items: {
        create: cart.items.map((item) => ({
          variantId: item.variantId,
          productName: item.variant.product.name,
          variantLabel: [item.variant.colour, item.variant.size].filter(Boolean).join(" / ") || "Default",
          quantity: item.quantity,
          unitPriceCents: item.variant.priceCents,
          totalCents: item.variant.priceCents * item.quantity,
        })),
      },
    },
  });

  // 6. Create Stripe PaymentIntent
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: totalCents,
      currency: currency.toLowerCase(),
      metadata: {
        orderId: order.id,
        userId,
        brandId,
        platform: "loocbooc_retail",
      },
      // Automatically confirm when consumer submits the Payment Element
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey: `retail_checkout_${order.id}` },
  );

  // 7. Store Stripe PI ID on the order
  await prisma.retailOrder.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return {
    orderId: order.id,
    clientSecret: paymentIntent.client_secret!,
    totalCents,
    currency,
  };
}

/**
 * Confirm a retail order after successful Stripe payment.
 * Called by the success page. Idempotent — safe to call multiple times.
 * Decrements variant stock and clears the cart.
 */
export async function confirmRetailOrder(
  userId: string,
  input: ConfirmOrderInput,
): Promise<RetailOrderDetail> {
  // Verify payment with Stripe
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(input.paymentIntentId);

  if (pi.status !== "succeeded") {
    throw new ServiceError(
      "PAYMENT_NOT_CONFIRMED",
      `Payment is not confirmed (status: ${pi.status}).`,
      400,
    );
  }

  const order = await prisma.retailOrder.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (!order || order.userId !== userId) {
    throw new ServiceError("NOT_FOUND", "Order not found.", 404);
  }
  if (order.stripePaymentIntentId !== input.paymentIntentId) {
    throw new ServiceError("PAYMENT_MISMATCH", "Payment intent does not match this order.", 400);
  }

  // Idempotency guard — already confirmed
  if (order.status === "confirmed" || order.status === "shipped" || order.status === "delivered") {
    return getRetailOrder(userId, order.id);
  }

  // Confirm the order and decrement stock in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.retailOrder.update({
      where: { id: order.id },
      data: {
        status: "confirmed",
        stripeChargeId: pi.latest_charge as string | undefined,
      },
    });

    // Decrement stock for each variant
    for (const item of order.items) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId, stockTracked: true },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Update product sales stats
    for (const item of order.items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { productId: true },
      });
      if (variant) {
        await tx.retailProduct.update({
          where: { id: variant.productId },
          data: {
            totalSold:        { increment: item.quantity },
            totalRevenueCents: { increment: item.totalCents },
          },
        });
      }
    }

    // Clear the user's cart
    const cart = await tx.cart.findFirst({ where: { userId } });
    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
  });

  return getRetailOrder(userId, order.id);
}

/**
 * Get a single retail order.
 */
export async function getRetailOrder(userId: string, orderId: string): Promise<RetailOrderDetail> {
  const order = await prisma.retailOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: { select: { imageUrl: true } },
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new ServiceError("NOT_FOUND", "Order not found.", 404);
  }

  // Get brand name
  const brand = await prisma.brand.findUnique({
    where: { id: order.brandId },
    select: { name: true },
  });

  return {
    id: order.id,
    status: order.status,
    brandId: order.brandId,
    brandName: brand?.name ?? "Unknown Brand",
    totalCents: order.totalCents,
    currency: order.currency,
    itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
    createdAt: order.createdAt.toISOString(),
    shippedAt: order.shippedAt?.toISOString() ?? null,
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      totalCents: i.totalCents,
      imageUrl: i.variant.imageUrl,
    })),
    shippingAddress: order.shippingAddress as never,
    stripePaymentIntentId: order.stripePaymentIntentId,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

/**
 * List all retail orders for a consumer.
 */
export async function listConsumerOrders(
  userId: string,
  opts: { limit: number; offset: number },
): Promise<{ data: RetailOrderSummary[]; total: number; hasMore: boolean }> {
  const where = { userId };
  const [orders, total] = await Promise.all([
    prisma.retailOrder.findMany({
      where,
      include: {
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: opts.offset,
      take: opts.limit,
    }),
    prisma.retailOrder.count({ where }),
  ]);

  // Batch-fetch brand names
  const brandIds = [...new Set(orders.map((o) => o.brandId))];
  const brands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: { id: true, name: true },
  });
  const brandMap = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  return {
    data: orders.map((o) => ({
      id: o.id,
      status: o.status,
      brandId: o.brandId,
      brandName: brandMap[o.brandId] ?? "Unknown Brand",
      totalCents: o.totalCents,
      currency: o.currency,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      createdAt: o.createdAt.toISOString(),
      shippedAt: o.shippedAt?.toISOString() ?? null,
      trackingNumber: o.trackingNumber,
      trackingCarrier: o.trackingCarrier,
    })),
    total,
    hasMore: opts.offset + opts.limit < total,
  };
}
