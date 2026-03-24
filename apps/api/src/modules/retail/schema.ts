/**
 * Retail Platform — Zod validation schemas.
 *
 * All request bodies and query params are validated here before
 * reaching the service layer. Types are inferred from schemas.
 */

import { z } from "zod";

// ─────────────────────────────────────────────
// Variant schema (reused in product create/update)
// ─────────────────────────────────────────────

export const VariantSchema = z.object({
  sku: z.string().max(100).optional(),
  colour: z.string().max(100).optional(),
  colourHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex colour (e.g. #FF5500)").optional(),
  size: z.string().max(20).optional(),
  sizeSystem: z.enum(["AU", "US", "EU", "UK", "INT"]).optional(),
  priceCents: z.number().int().min(0),
  comparePriceCents: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).default(0),
  stockTracked: z.boolean().default(true),
  barcode: z.string().max(100).optional(),
  weightGrams: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isAvailable: z.boolean().default(true),
});

export type VariantInput = z.infer<typeof VariantSchema>;

// ─────────────────────────────────────────────
// Product CRUD
// ─────────────────────────────────────────────

export const CreateProductSchema = z.object({
  brandId: z.string().cuid(),
  garmentId: z.string().cuid().optional(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(150).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(10000).optional(),
  category: z.string().max(100).optional(),
  gender: z.enum(["womens", "mens", "unisex", "kids"]).optional(),
  season: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  priceCents: z.number().int().min(0),
  comparePriceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("AUD"),
  coverImageUrl: z.string().url().optional(),
  galleryUrls: z.array(z.string().url()).max(20).default([]),
  weightGrams: z.number().int().min(0).optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  shopifyProductId: z.string().optional(),
  variants: z.array(VariantSchema).min(1, "At least one variant is required"),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.omit({ brandId: true, variants: true }).partial().extend({
  variants: z.array(VariantSchema.extend({ id: z.string().cuid().optional() })).optional(),
  status: z.enum(["draft", "active", "archived", "out_of_stock"]).optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

// ─────────────────────────────────────────────
// Browse / search
// ─────────────────────────────────────────────

export const BrowseProductsQuerySchema = z.object({
  brandId:       z.string().cuid().optional(),
  category:      z.string().optional(),
  gender:        z.enum(["womens", "mens", "unisex", "kids"]).optional(),
  search:        z.string().max(200).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "best_selling"])
    .optional()
    .default("newest"),
  limit:  z.coerce.number().int().min(1).max(50).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export type BrowseProductsQuery = z.infer<typeof BrowseProductsQuerySchema>;

// ─────────────────────────────────────────────
// Cart
// ─────────────────────────────────────────────

export const AddToCartSchema = z.object({
  variantId: z.string().cuid(),
  quantity:  z.number().int().min(1).max(10),
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(10), // 0 = remove item
});

export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

// ─────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────

const AddressSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  line1:     z.string().min(1).max(255),
  line2:     z.string().max(255).optional(),
  city:      z.string().min(1).max(100),
  state:     z.string().min(1).max(100),
  postcode:  z.string().min(1).max(20),
  country:   z.string().length(2), // ISO 3166-1 alpha-2
  phone:     z.string().max(30).optional(),
});

export const CreateCheckoutSessionSchema = z.object({
  cartId:          z.string().cuid(),
  shippingAddress: AddressSchema,
  billingAddress:  AddressSchema.optional(),
  notes:           z.string().max(500).optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;

export const ConfirmOrderSchema = z.object({
  paymentIntentId: z.string().min(1),
  orderId:         z.string().cuid(),
});

export type ConfirmOrderInput = z.infer<typeof ConfirmOrderSchema>;
