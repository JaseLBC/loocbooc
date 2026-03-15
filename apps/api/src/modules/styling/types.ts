/**
 * Styling Marketplace — shared TypeScript types.
 *
 * The Styling Marketplace connects consumers who want personalised styling advice
 * with vetted stylists. Flow:
 *
 *   Consumer submits a brief (occasion, budget, avatar measurements, style notes)
 *     → Open briefs are visible to available stylists
 *     → Stylist accepts the brief (status: assigned → in_progress)
 *     → Stylist builds and publishes a lookbook of products
 *     → Consumer reviews lookbook, accepts
 *     → Purchases are tracked — stylist earns a commission per item purchased
 *
 * Revenue model:
 *   - Loocbooc takes 5% platform fee on top of stylist commission
 *   - Stylist default commission: 15% of in-platform purchases
 *   - Stripe Connect handles stylist payouts
 */

// ─────────────────────────────────────────────
// Stylist types
// ─────────────────────────────────────────────

export interface StylistSummary {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  specialisations: string[];
  styleKeywords: string[];
  pricePerBriefCents: number;
  commissionPercent: number;
  verified: boolean;
  isAvailable: boolean;
  instagramHandle: string | null;
  websiteUrl: string | null;
  completedBriefs: number;
  avgRating: number | null;
  ratingCount: number;
  portfolioItems: PortfolioItemSummary[];
  createdAt: string;
}

export interface PortfolioItemSummary {
  id: string;
  imageUrl: string;
  caption: string | null;
  occasion: string | null;
  sortOrder: number;
}

export interface StylistRatingSummary {
  id: string;
  rating: number;
  review: string | null;
  userId: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Style brief types
// ─────────────────────────────────────────────

export type BriefStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "delivered"
  | "accepted"
  | "closed";

export interface StyleBriefSummary {
  id: string;
  userId: string;
  title: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  occasion: string[];
  styleNotes: string | null;
  brandPreferences: string[];
  excludedBrands: string[];
  sizeInfo: Record<string, unknown> | null;
  avatarId: string | null;
  status: BriefStatus;
  stylistId: string | null;
  assignedAt: string | null;
  deadline: string | null;
  hasLookbook: boolean;
  createdAt: string;
  updatedAt: string;
  // Populated when fetching from stylist's perspective
  stylist?: StylistSummary | null;
  // Populated on consumer view
  lookbook?: StyleBriefLookbookSummary | null;
}

// ─────────────────────────────────────────────
// Lookbook types
// ─────────────────────────────────────────────

export type LookbookStatus = "draft" | "published" | "accepted" | "closed";

export interface LookbookItemSummary {
  id: string;
  productName: string;
  brandName: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  externalUrl: string | null;
  campaignId: string | null;
  skuId: string | null;
  stylistNote: string | null;
  sortOrder: number;
  purchasedAt: string | null;
  createdAt: string;
}

export interface StyleBriefLookbookSummary {
  id: string;
  briefId: string;
  stylistId: string;
  title: string | null;
  notes: string | null;
  status: LookbookStatus;
  publishedAt: string | null;
  acceptedAt: string | null;
  items: LookbookItemSummary[];
  totalItems: number;
  totalValueCents: number;
  purchasedCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Styling marketplace search results
// ─────────────────────────────────────────────

export interface StylistSearchResult {
  stylists: StylistSummary[];
  total: number;
  hasMore: boolean;
}

export interface BriefFeedItem {
  id: string;
  title: string | null;
  occasion: string[];
  budgetRange: string | null;
  styleNotes: string | null;
  sizeHint: string | null;    // e.g. "AU 12" — derived from avatar or sizeInfo
  createdAt: string;
  deadline: string | null;
  hasAvatar: boolean;
}

// ─────────────────────────────────────────────
// Commission types
// ─────────────────────────────────────────────

export interface CommissionSummary {
  stylistId: string;
  totalEarnedCents: number;
  pendingCents: number;     // earned but not yet paid out
  paidOutCents: number;
  commissionPercent: number;
  platformFeePercent: number;
  recentActivity: CommissionActivity[];
}

export interface CommissionActivity {
  date: string;
  productName: string;
  brandName: string;
  purchasePriceCents: number;
  commissionCents: number;
  status: "earned" | "paid";
}
