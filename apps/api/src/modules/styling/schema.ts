/**
 * Styling Marketplace — Zod validation schemas.
 */

import { z } from "zod";

// ─────────────────────────────────────────────
// Stylist
// ─────────────────────────────────────────────

export const CreateStylistSchema = z.object({
  displayName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  bio: z.string().max(1000).optional(),
  location: z.string().max(100).optional(),
  specialisations: z.array(z.string().max(50)).max(10).default([]),
  styleKeywords: z.array(z.string().max(50)).max(20).default([]),
  pricePerBriefCents: z.number().int().min(0).max(100000).default(0),
  commissionPercent: z.number().int().min(5).max(40).default(15),
  instagramHandle: z.string().max(60).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
});

export const UpdateStylistSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  bio: z.string().max(1000).optional(),
  location: z.string().max(100).optional(),
  specialisations: z.array(z.string().max(50)).max(10).optional(),
  styleKeywords: z.array(z.string().max(50)).max(20).optional(),
  pricePerBriefCents: z.number().int().min(0).max(100000).optional(),
  commissionPercent: z.number().int().min(5).max(40).optional(),
  isAvailable: z.boolean().optional(),
  instagramHandle: z.string().max(60).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  avatarUrl: z.string().url().optional(),
});

export const AddPortfolioItemSchema = z.object({
  imageUrl: z.string().url(),
  caption: z.string().max(300).optional(),
  occasion: z.string().max(60).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const RateStylistSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
  briefId: z.string().optional(),
});

// ─────────────────────────────────────────────
// Style brief
// ─────────────────────────────────────────────

export const CreateBriefSchema = z.object({
  title: z.string().max(200).optional(),
  budgetMinCents: z.number().int().min(0).optional(),
  budgetMaxCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("AUD"),
  occasion: z.array(z.string().max(50)).max(5).default([]),
  styleNotes: z.string().max(3000).optional(),
  brandPreferences: z.array(z.string().max(100)).max(10).default([]),
  excludedBrands: z.array(z.string().max(100)).max(10).default([]),
  avatarId: z.string().optional(),
  deadline: z.string().datetime().optional(),
  // Optional: directly request a specific stylist
  preferredStylistId: z.string().optional(),
}).refine((d) => {
  if (d.budgetMinCents !== undefined && d.budgetMaxCents !== undefined) {
    return d.budgetMaxCents >= d.budgetMinCents;
  }
  return true;
}, {
  message: "Budget max must be greater than or equal to budget min",
  path: ["budgetMaxCents"],
});

export const UpdateBriefSchema = z.object({
  title: z.string().max(200).optional(),
  budgetMinCents: z.number().int().min(0).optional(),
  budgetMaxCents: z.number().int().min(0).optional(),
  occasion: z.array(z.string().max(50)).max(5).optional(),
  styleNotes: z.string().max(3000).optional(),
  brandPreferences: z.array(z.string().max(100)).max(10).optional(),
  excludedBrands: z.array(z.string().max(100)).max(10).optional(),
  deadline: z.string().datetime().optional().nullable(),
});

// ─────────────────────────────────────────────
// Lookbook
// ─────────────────────────────────────────────

export const AddLookbookItemSchema = z.object({
  productName: z.string().min(1).max(200),
  brandName: z.string().min(1).max(100),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("AUD"),
  imageUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  campaignId: z.string().optional(),
  skuId: z.string().optional(),
  stylistNote: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateLookbookItemSchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  brandName: z.string().min(1).max(100).optional(),
  priceCents: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
  stylistNote: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateLookbookSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(3000).optional(),
});

// ─────────────────────────────────────────────
// Stylist search
// ─────────────────────────────────────────────

export const StylistSearchSchema = z.object({
  search: z.string().max(100).optional(),
  specialisation: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  onlyAvailable: z.coerce.boolean().default(false),
  onlyVerified: z.coerce.boolean().default(false),
  maxBudgetCents: z.coerce.number().int().min(0).optional(),
});

export type CreateStylistInput = z.infer<typeof CreateStylistSchema>;
export type UpdateStylistInput = z.infer<typeof UpdateStylistSchema>;
export type AddPortfolioItemInput = z.infer<typeof AddPortfolioItemSchema>;
export type RateStylistInput = z.infer<typeof RateStylistSchema>;
export type CreateBriefInput = z.infer<typeof CreateBriefSchema>;
export type UpdateBriefInput = z.infer<typeof UpdateBriefSchema>;
export type AddLookbookItemInput = z.infer<typeof AddLookbookItemSchema>;
export type UpdateLookbookItemInput = z.infer<typeof UpdateLookbookItemSchema>;
export type UpdateLookbookInput = z.infer<typeof UpdateLookbookSchema>;
export type StylistSearchInput = z.infer<typeof StylistSearchSchema>;
