/**
 * Manufacturer Marketplace — TypeScript output types.
 * These represent the shapes returned by the service layer to route handlers.
 */

// ── Aggregated rating scores ──────────────────────────────────────────────────

export interface AggregatedRatings {
  overall: number;
  quality: number;
  communication: number;
  timeliness: number;
  totalReviews: number;
}

// ── Profile shapes ────────────────────────────────────────────────────────────

export interface ManufacturerProfileSummary {
  id: string;
  manufacturerId: string;
  displayName: string;
  heroImageUrl: string | null;
  country: string;
  city: string | null;
  moqMin: number;
  moqMax: number | null;
  sampleLeadTimeDays: number;
  bulkLeadTimeDays: number;
  specialisations: string[];
  certifications: string[];
  priceTier: string;
  isVerified: boolean;
  isFeatured: boolean;
  responseTimeHours: number | null;
  ratings: AggregatedRatings;
}

export interface ManufacturerProfileFull extends ManufacturerProfileSummary {
  description: string | null;
  galleryImageUrls: string[];
  videoUrl: string | null;
  yearEstablished: number | null;
  employeeCount: string | null;
  monthlyCapacityMin: number | null;
  monthlyCapacityMax: number | null;
  materials: string[];
  exportMarkets: string[];
  techPackFormats: string[];
  languages: string[];
  verifiedAt: Date | null;
  recentReviews: ReviewSummary[];
  relatedManufacturers: ManufacturerProfileSummary[];
}

export interface ReviewSummary {
  id: string;
  brandId: string;
  brandName: string;
  overallScore: number;
  qualityScore: number;
  communicationScore: number;
  timelinessScore: number;
  review: string | null;
  ordersCompleted: number;
  createdAt: Date;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedManufacturers {
  data: ManufacturerProfileSummary[];
  pagination: PaginationMeta;
}

// ── Connection ────────────────────────────────────────────────────────────────

export interface ConnectionResult {
  id: string;
  brandId: string;
  manufacturerProfileId: string;
  status: string;
  enquiryMessage: string | null;
  respondedAt: Date | null;
  connectedAt: Date | null;
  createdAt: Date;
  manufacturerProfile?: ManufacturerProfileSummary;
}

// ── Matching ──────────────────────────────────────────────────────────────────

export interface MatchedManufacturer extends ManufacturerProfileSummary {
  matchScore: number;           // 0–100
  matchReasons: string[];       // human-readable reasons
}

export interface ManufacturerMatchResult {
  matches: MatchedManufacturer[];
  matchedAt: Date;
}
