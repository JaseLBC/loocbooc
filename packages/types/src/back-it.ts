/**
 * Back It module types — campaigns, backings, size breaks.
 * This is the first live module. These types are central to the platform.
 */

export type CampaignStatus =
  | "draft"          // Brand is editing, not publicly visible
  | "scheduled"      // Approved, waiting for campaign_start date
  | "active"         // Live, accepting backings
  | "moq_reached"    // MOQ threshold hit, locked in
  | "funded"         // Full payment captured, sent to manufacturer
  | "in_production"  // Manufacturer confirmed production
  | "shipped"        // Tracking active
  | "completed"      // Delivered to all backers
  | "cancelled"      // Brand cancelled pre-MOQ
  | "expired";       // Deadline passed, MOQ not reached — refunds processed

export type BackingStatus = "active" | "cancelled" | "refunded" | "fulfilled";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "not_required";

export interface BackItCampaign {
  id: string;
  brandId: string;
  garmentId: string;
  title: string;
  description: string | null;
  slug: string;
  status: CampaignStatus;

  // Pricing
  retailPriceCents: number;   // Full retail price post-production
  backerPriceCents: number;   // Discounted backer price
  depositPercent: number;     // 100 = full payment upfront. Default: 100
  currency: string;           // ISO 4217

  // MOQ
  moq: number;                          // Minimum order qty to trigger production
  currentBackingCount: number;
  moqReached: boolean;
  moqReachedAt: Date | null;
  stretchGoalQty: number | null;        // Optional: unlock colourway/feature

  // Timeline
  campaignStart: Date;
  campaignEnd: Date;
  estimatedShipDate: Date | null;

  // Manufacturer
  manufacturerId: string | null;
  manufacturerNotifiedAt: Date | null;

  // Shopify integration
  shopifyProductId: string | null;
  shopifyStoreUrl: string | null;

  // Assets
  coverImageUrl: string | null;
  galleryUrls: string[];
  techPackPreviewUrl: string | null;

  // Sizes
  availableSizes: string[];
  sizeLimits: Record<string, number> | null; // e.g. {"S": 50, "M": 100}

  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackItBacking {
  id: string;
  campaignId: string;
  userId: string;
  orderId: string | null;

  size: string;
  quantity: number;

  // Payment
  totalCents: number;
  depositCents: number;     // Amount charged immediately
  remainingCents: number;   // Amount to charge on MOQ reached (if depositPercent < 100)
  currency: string;

  // Stripe
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  depositStatus: PaymentStatus;
  finalPaymentStatus: PaymentStatus;

  // Shopify
  shopifyOrderId: string | null;
  shopifyLineItemId: string | null;

  status: BackingStatus;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  refundStripeId: string | null;

  shippingAddress: ShippingAddress;

  createdAt: Date;
  updatedAt: Date;
}

export interface SizeBreak {
  id: string;
  campaignId: string;
  size: string;
  backingCount: number;
  capturedAt: Date;
}

export interface CampaignEvent {
  id: string;
  campaignId: string;
  eventType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
  phone?: string;
}

// Input types for API requests

export interface CreateCampaignInput {
  brandId: string;
  garmentId: string;
  title: string;
  description?: string;
  slug: string;
  retailPriceCents: number;
  backerPriceCents: number;
  depositPercent?: number;
  currency?: string;
  moq: number;
  stretchGoalQty?: number;
  campaignStart: string; // ISO 8601
  campaignEnd: string;   // ISO 8601
  estimatedShipDate?: string; // YYYY-MM-DD
  manufacturerId?: string;
  shopifyStoreUrl?: string;
  availableSizes: string[];
  sizeLimits?: Record<string, number>;
}

export interface PlaceBackingInput {
  size: string;
  quantity?: number;
  shippingAddress: ShippingAddress;
  paymentMethodId: string; // Stripe PaymentMethod ID
}

export interface CampaignProgressResponse {
  campaignId: string;
  currentBackingCount: number;
  moq: number;
  moqReached: boolean;
  percentComplete: number; // 0–100
  sizeBreaks: SizeBreak[];
}
