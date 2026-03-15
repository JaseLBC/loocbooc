/**
 * Universal Avatar module — Zod/JSON schemas for request validation.
 *
 * All schemas are defined as JSON Schema objects for Fastify's AJV validator.
 * TypeScript types are inferred from Zod equivalents for service layer use.
 */

import { z } from "zod";

// ─────────────────────────────────────────────
// Create Avatar
// ─────────────────────────────────────────────

export const CreateAvatarSchema = z.object({
  nickname: z.string().max(100).optional(),
  // Basics
  height: z.number().min(100).max(250).optional(),        // cm
  weightKg: z.number().min(20).max(300).optional(),       // kg
  // Upper
  bust: z.number().min(50).max(200).optional(),           // cm
  chest: z.number().min(50).max(200).optional(),          // cm
  shoulderWidth: z.number().min(20).max(80).optional(),   // cm
  sleeveLength: z.number().min(30).max(100).optional(),   // cm
  neck: z.number().min(20).max(60).optional(),            // cm
  // Mid
  waist: z.number().min(40).max(200).optional(),          // cm
  // Lower
  hips: z.number().min(50).max(200).optional(),           // cm
  inseam: z.number().min(40).max(120).optional(),         // cm
  thigh: z.number().min(20).max(100).optional(),          // cm
  rise: z.number().min(15).max(50).optional(),            // cm
  // Style
  bodyShape: z.enum(["hourglass", "pear", "apple", "rectangle", "inverted_triangle"]).optional(),
  fitPreference: z.enum(["slim", "regular", "relaxed", "oversized"]).optional(),
  // Measurement method
  measurementMethod: z.enum(["manual", "estimated", "scan"]).optional(),
});

export type CreateAvatarInput = z.infer<typeof CreateAvatarSchema>;

// ─────────────────────────────────────────────
// Update Avatar
// ─────────────────────────────────────────────

export const UpdateAvatarSchema = CreateAvatarSchema.extend({
  isPrimary: z.boolean().optional(),
  sizeAu: z.string().max(10).optional(),
  sizeUs: z.string().max(10).optional(),
  sizeEu: z.string().max(10).optional(),
}).partial();

export type UpdateAvatarInput = z.infer<typeof UpdateAvatarSchema>;

// ─────────────────────────────────────────────
// Fit recommendation request
// ─────────────────────────────────────────────

export const SizeChartRowSchema = z.object({
  size: z.string(),
  bustMin: z.number().optional(),
  bustMax: z.number().optional(),
  waistMin: z.number().optional(),
  waistMax: z.number().optional(),
  hipsMin: z.number().optional(),
  hipsMax: z.number().optional(),
  inseamMin: z.number().optional(),
  inseamMax: z.number().optional(),
  shoulderMin: z.number().optional(),
  shoulderMax: z.number().optional(),
  chestMin: z.number().optional(),
  chestMax: z.number().optional(),
});

export const SizeChartSchema = z.object({
  brandId: z.string(),
  garmentId: z.string().optional(),
  name: z.string().max(200),
  category: z.string().max(100),
  sizeSystem: z.enum(["AU", "US", "EU", "UK", "INT"]),
  rows: z.array(SizeChartRowSchema).min(1).max(30),
});

export type CreateSizeChartInput = z.infer<typeof SizeChartSchema>;

export const GetFitRecommendationSchema = z.object({
  avatarId: z.string().cuid(),
  skuId: z.string().cuid(),
  sizeChartId: z.string().cuid().optional(),
  sizeChart: z.object({
    brand: z.string(),
    category: z.string(),
    sizeSystem: z.string(),
    rows: z.array(SizeChartRowSchema),
  }).optional(),
});

export type GetFitRecommendationInput = z.infer<typeof GetFitRecommendationSchema>;

// ─────────────────────────────────────────────
// Taste signal
// ─────────────────────────────────────────────

export const RecordTasteSignalSchema = z.object({
  avatarId: z.string().cuid().optional(),
  signalType: z.enum([
    "product_view",
    "product_like",
    "product_save",
    "backing_placed",
    "size_selected",
    "style_quiz_answer",
    "campaign_browsed",
    "manufacturer_viewed",
    "search_query",
  ]),
  entityId: z.string().optional(),
  entityType: z.string().max(50).optional(),
  payload: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
});

export type RecordTasteSignalInput = z.infer<typeof RecordTasteSignalSchema>;

// ─────────────────────────────────────────────
// Route params
// ─────────────────────────────────────────────

export const AvatarParamsSchema = z.object({
  avatarId: z.string().cuid(),
});

export const SizeChartParamsSchema = z.object({
  chartId: z.string().cuid(),
});

// ─────────────────────────────────────────────
// JSON Schema equivalents (for Fastify AJV)
// ─────────────────────────────────────────────

export const avatarBodyJsonSchema = {
  type: "object",
  properties: {
    nickname: { type: "string", maxLength: 100 },
    height: { type: "number", minimum: 100, maximum: 250 },
    weightKg: { type: "number", minimum: 20, maximum: 300 },
    bust: { type: "number", minimum: 50, maximum: 200 },
    chest: { type: "number", minimum: 50, maximum: 200 },
    waist: { type: "number", minimum: 40, maximum: 200 },
    hips: { type: "number", minimum: 50, maximum: 200 },
    inseam: { type: "number", minimum: 40, maximum: 120 },
    shoulderWidth: { type: "number", minimum: 20, maximum: 80 },
    sleeveLength: { type: "number", minimum: 30, maximum: 100 },
    neck: { type: "number", minimum: 20, maximum: 60 },
    thigh: { type: "number", minimum: 20, maximum: 100 },
    rise: { type: "number", minimum: 15, maximum: 50 },
    bodyShape: { type: "string", enum: ["hourglass", "pear", "apple", "rectangle", "inverted_triangle"] },
    fitPreference: { type: "string", enum: ["slim", "regular", "relaxed", "oversized"] },
    measurementMethod: { type: "string", enum: ["manual", "estimated", "scan"] },
    isPrimary: { type: "boolean" },
    sizeAu: { type: "string", maxLength: 10 },
    sizeUs: { type: "string", maxLength: 10 },
    sizeEu: { type: "string", maxLength: 10 },
  },
  additionalProperties: false,
} as const;

export const fitRecommendationQueryJsonSchema = {
  type: "object",
  required: ["avatarId", "skuId"],
  properties: {
    avatarId: { type: "string" },
    skuId: { type: "string" },
    sizeChartId: { type: "string" },
  },
  additionalProperties: false,
} as const;
