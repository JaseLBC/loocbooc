/**
 * Manufacturer Marketplace — Zod validation schemas.
 * All route input validation flows through here.
 */

import { z } from "zod";

// ── Filters / Search ──────────────────────────────────────────────────────────

export const SearchManufacturersQuerySchema = z.object({
  country: z.string().length(2).optional(),
  specialisation: z.string().optional(),
  certifications: z.string().optional(), // comma-separated
  moqMin: z.coerce.number().int().nonnegative().optional(),
  moqMax: z.coerce.number().int().positive().optional(),
  priceTier: z.enum(["mass", "mid", "premium", "luxury"]).optional(),
  capacityMin: z.coerce.number().int().positive().optional(),
  isVerified: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchManufacturersQuery = z.infer<typeof SearchManufacturersQuerySchema>;

// ── Profile ───────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  heroImageUrl: z.string().url().optional().nullable(),
  galleryImageUrls: z.array(z.string().url()).max(12).optional(),
  videoUrl: z.string().url().optional().nullable(),
  country: z.string().length(2).optional(),
  city: z.string().max(100).optional().nullable(),
  yearEstablished: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  employeeCount: z.string().max(20).optional().nullable(),
  monthlyCapacityMin: z.number().int().positive().optional().nullable(),
  monthlyCapacityMax: z.number().int().positive().optional().nullable(),
  moqMin: z.number().int().nonnegative().optional(),
  moqMax: z.number().int().positive().optional().nullable(),
  sampleLeadTimeDays: z.number().int().positive().optional(),
  bulkLeadTimeDays: z.number().int().positive().optional(),
  specialisations: z.array(z.string()).max(20).optional(),
  materials: z.array(z.string()).max(30).optional(),
  certifications: z.array(z.string()).max(20).optional(),
  exportMarkets: z.array(z.string()).max(30).optional(),
  priceTier: z.enum(["mass", "mid", "premium", "luxury"]).optional(),
  techPackFormats: z.array(z.enum(["pdf", "excel", "clo3d", "loocbooc_native"])).optional(),
  languages: z.array(z.string()).max(10).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ── Enquiry ───────────────────────────────────────────────────────────────────

export const CreateEnquirySchema = z.object({
  message: z.string().min(10).max(2000),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquirySchema>;

export const RespondToEnquirySchema = z.object({
  accept: z.boolean(),
  message: z.string().min(1).max(2000).optional(),
});

export type RespondToEnquiryInput = z.infer<typeof RespondToEnquirySchema>;

// ── Rating ────────────────────────────────────────────────────────────────────

export const SubmitRatingSchema = z.object({
  overallScore: z.number().int().min(1).max(5),
  qualityScore: z.number().int().min(1).max(5),
  communicationScore: z.number().int().min(1).max(5),
  timelinessScore: z.number().int().min(1).max(5),
  review: z.string().max(3000).optional(),
  ordersCompleted: z.number().int().min(1).default(1),
});

export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;

// ── Params ────────────────────────────────────────────────────────────────────

export const ManufacturerParamsSchema = z.object({
  id: z.string().cuid(),
});

export const ConnectionParamsSchema = z.object({
  id: z.string().cuid(),
});
