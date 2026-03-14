/**
 * Back It API request/response schemas — Zod validation.
 * Used by Fastify route handlers for input validation and type inference.
 */

import { z } from "zod";

// ── Shared ──────────────────────────────────────────────────────────────────

export const ShippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  phone: z.string().optional(),
});

// ── Campaign ─────────────────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  garmentId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  slug: z
    .string()
    .min(1)
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  retailPriceCents: z.number().int().positive(),
  backerPriceCents: z.number().int().positive(),
  depositPercent: z.number().int().min(10).max(100).default(100),
  currency: z.string().length(3).default("AUD"),
  moq: z.number().int().positive(),
  stretchGoalQty: z.number().int().positive().optional(),
  campaignStart: z.string().datetime(),
  campaignEnd: z.string().datetime(),
  estimatedShipDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  manufacturerId: z.string().uuid().optional(),
  shopifyStoreUrl: z.string().url().optional(),
  availableSizes: z.array(z.string().min(1)).min(1),
  sizeLimits: z.record(z.number().int().positive()).optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = CreateCampaignSchema.partial().omit({
  garmentId: true,
});

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

export const CampaignParamsSchema = z.object({
  id: z.string().uuid(),
});

export const BrandCampaignsParamsSchema = z.object({
  brandId: z.string().uuid(),
});

export const BrandCampaignsQuerySchema = z.object({
  status: z
    .enum([
      "draft", "scheduled", "active", "moq_reached", "funded",
      "in_production", "shipped", "completed", "cancelled", "expired",
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ── Backing ───────────────────────────────────────────────────────────────────

export const PlaceBackingSchema = z.object({
  size: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  shippingAddress: ShippingAddressSchema,
  paymentMethodId: z.string().min(1), // Stripe PaymentMethod ID
});

export type PlaceBackingInput = z.infer<typeof PlaceBackingSchema>;

export const BackingParamsSchema = z.object({
  id: z.string().uuid(),    // campaign ID
  backingId: z.string().uuid(),
});

// ── Payment Intent creation (step 1 of 2-step Stripe flow) ──────────────────
// Consumer submits size + address → server creates a Stripe PaymentIntent.
// Stripe Elements collects card details on the client.

export const CreatePaymentIntentSchema = z.object({
  size: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  shippingAddress: ShippingAddressSchema,
});

export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentSchema>;

// ── Confirm backing (step 2 of 2-step Stripe flow) ──────────────────────────
// After Stripe redirects back with a confirmed PaymentIntent, the client
// posts the paymentIntentId to finalise the backing record in our DB.

export const ConfirmBackingSchema = z.object({
  paymentIntentId: z.string().min(1),
});

export type ConfirmBackingInput = z.infer<typeof ConfirmBackingSchema>;
