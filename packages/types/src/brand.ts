/**
 * Brand and BrandMember entity types.
 * A brand can have multiple members with different roles.
 */

export type BrandTier = "starter" | "growth" | "enterprise";
export type BrandMemberRole = "admin" | "member" | "viewer";

export interface Brand {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  country: string | null; // ISO 3166-1 alpha-2
  currency: string; // ISO 4217 — default: AUD
  shopifyStoreUrl: string | null;
  shopifyAccessToken: string | null; // encrypted at rest
  stripeAccountId: string | null; // Stripe Connect
  verified: boolean;
  tier: BrandTier;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandMember {
  id: string;
  brandId: string;
  userId: string;
  role: BrandMemberRole;
  createdAt: Date;
}

export interface CreateBrandInput {
  name: string;
  slug: string;
  description?: string;
  country?: string;
  currency?: string;
  shopifyStoreUrl?: string;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  country?: string;
  currency?: string;
  shopifyStoreUrl?: string;
  settings?: Record<string, unknown>;
}
