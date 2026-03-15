/**
 * Garments module — Zod validation schemas.
 *
 * Input schemas are intentionally permissive on optional fields.
 * Required fields are enforced server-side to give helpful validation messages.
 */

import { z } from "zod";

// ─── Garment status ──────────────────────────────────────────────────────────
// These are the consumer-facing statuses, not the Prisma GarmentStatus enum.
// 'processing' and 'active' are derived from the pipeline state, stored in
// garment.metadata.processingStatus

export const GarmentStatusValues = [
  "draft",
  "processing",
  "active",
  "updating",
  "error",
  "archived",
  "deleted",
] as const;

export const GarmentCategoryValues = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "suits",
  "activewear",
  "swimwear",
  "underwear",
  "accessories",
  "footwear",
  "bags",
  "hats",
  "other",
] as const;

export const GarmentSeasonValues = [
  "SS",
  "AW",
  "all-season",
  "resort",
] as const;

export const UploadMethodValues = [
  "clo3d",
  "pattern",
  "photos",
  "measurements",
] as const;

// ─── Create garment ──────────────────────────────────────────────────────────

export const CreateGarmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.enum(GarmentCategoryValues),
  season: z.enum(GarmentSeasonValues).optional(),
  sku: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  fabricComposition: z.string().max(500).optional(),
  measurements: z
    .object({
      chest: z.number().positive().optional(),
      waist: z.number().positive().optional(),
      hem: z.number().positive().optional(),
      sleeveLength: z.number().positive().optional(),
      totalLength: z.number().positive().optional(),
      shoulderWidth: z.number().positive().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  uploadMethod: z.enum(UploadMethodValues).optional(),
});

export type CreateGarmentInput = z.infer<typeof CreateGarmentSchema>;

// ─── Update garment ──────────────────────────────────────────────────────────

export const UpdateGarmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(GarmentCategoryValues).optional(),
  season: z.enum(GarmentSeasonValues).optional(),
  sku: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  fabricComposition: z.string().max(500).optional(),
  measurements: z
    .object({
      chest: z.number().positive().optional(),
      waist: z.number().positive().optional(),
      hem: z.number().positive().optional(),
      sleeveLength: z.number().positive().optional(),
      totalLength: z.number().positive().optional(),
      shoulderWidth: z.number().positive().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  fabricPhysics: z
    .object({
      drape: z.number().min(0).max(100),
      stretch: z.number().min(0).max(100),
      weight: z.number().min(0).max(100),
      breathability: z.number().min(0).max(100),
      sheen: z.number().min(0).max(100),
    })
    .optional(),
  status: z
    .enum(["draft", "archived"])
    .optional(),
});

export type UpdateGarmentInput = z.infer<typeof UpdateGarmentSchema>;

// ─── Garment list filters ─────────────────────────────────────────────────────

export const GarmentFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  category: z.enum(GarmentCategoryValues).optional(),
  status: z.enum(GarmentStatusValues).optional(),
  season: z.enum(GarmentSeasonValues).optional(),
  sortBy: z.enum(["createdAt", "name", "status"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type GarmentFiltersInput = z.infer<typeof GarmentFiltersSchema>;

// ─── Fabric physics derivation ────────────────────────────────────────────────

export const FabricPhysicsQuerySchema = z.object({
  composition: z.string().min(1).max(500),
});

export type FabricPhysicsQuery = z.infer<typeof FabricPhysicsQuerySchema>;
