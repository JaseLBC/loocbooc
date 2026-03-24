/**
 * Retail Platform — internal TypeScript types.
 *
 * Defines shapes for API responses and service return values.
 * Separate from Prisma-generated types to give us control over
 * what data is exposed to consumers vs. what stays internal.
 */

// ─────────────────────────────────────────────
// Product types
// ─────────────────────────────────────────────

export interface VariantSummary {
  id: string;
  sku: string | null;
  colour: string | null;
  colourHex: string | null;
  size: string | null;
  sizeSystem: string | null;
  priceCents: number;
  comparePriceCents: number | null;
  stock: number;
  stockTracked: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
}

export interface ProductSummary {
  id: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  name: string;
  slug: string;
  category: string | null;
  gender: string | null;
  tags: string[];
  status: string;
  priceCents: number;
  comparePriceCents: number | null;
  currency: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  totalSold: number;
  // Aggregated variant info
  colours: string[];            // distinct colours available
  sizes: string[];              // distinct sizes available
  isOnSale: boolean;
  hasStock: boolean;
  // Avatar fit (optional — only when avatarId provided)
  fitRecommendation?: FitRecommendation;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  season: string | null;
  weightGrams: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  variants: VariantSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface FitRecommendation {
  recommendedSize: string;
  confidence: number;     // 0–1
  fitLabel: string;       // "Great fit", "Good fit", "Slightly large", etc.
  sizeLabel: string;      // "AU 10 / US 6 / EU 38"
}

// ─────────────────────────────────────────────
// Browse / search
// ─────────────────────────────────────────────

export interface BrowseProductsQuery {
  brandId?: string;
  category?: string;
  gender?: string;
  search?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "best_selling";
  limit: number;
  offset: number;
}

export interface BrowseProductsResult {
  data: ProductSummary[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ─────────────────────────────────────────────
// Cart types
// ─────────────────────────────────────────────

export interface CartItemDetail {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  coverImageUrl: string | null;
  brandName: string;
  colour: string | null;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  currency: string;
  isAvailable: boolean;
  stock: number;
}

export interface CartSummary {
  id: string;
  items: CartItemDetail[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
  estimatedShippingCents: number;
  estimatedTaxCents: number;
  estimatedTotalCents: number;
}

// ─────────────────────────────────────────────
// Checkout / orders
// ─────────────────────────────────────────────

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string;
}

export interface CheckoutSessionResult {
  orderId: string;
  clientSecret: string;   // Stripe PaymentIntent client_secret
  totalCents: number;
  currency: string;
}

export interface RetailOrderSummary {
  id: string;
  status: string;
  brandId: string;
  brandName: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  shippedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
}

export interface RetailOrderDetail extends RetailOrderSummary {
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    imageUrl: string | null;
  }[];
  shippingAddress: ShippingAddress;
  stripePaymentIntentId: string | null;
  deliveredAt: string | null;
}

// ─────────────────────────────────────────────
// Brand product management
// ─────────────────────────────────────────────

export interface BrandProductStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  totalRevenueCents: number;
  totalUnitsSold: number;
  lowStockVariants: number;  // variants with stock <= 3
}
