/**
 * Universal Avatar module — TypeScript types.
 *
 * These are the shapes returned from service functions.
 * Prisma model types are extended here with computed fields
 * (e.g., recommended sizes, fit confidence labels).
 */

// ─────────────────────────────────────────────
// Avatar core
// ─────────────────────────────────────────────

export interface AvatarSummary {
  id: string;
  userId: string;
  nickname: string | null;
  isPrimary: boolean;
  measurementMethod: string | null;
  confidenceScore: number | null;
  confidenceLabel: "high" | "medium" | "low" | "uncalibrated";
  bodyShape: string | null;
  fitPreference: string | null;
  avatarImgUrl: string | null;
  avatar3dUrl: string | null;
  sizeAu: string | null;
  sizeUs: string | null;
  sizeEu: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed human summary
  completionPercent: number; // 0–100, how many measurements are filled
  hasFitHistory: boolean;
}

export interface AvatarFull extends AvatarSummary {
  measurements: AvatarMeasurements;
  fitResults: FitResultSummary[];
  tasteProfile: TasteProfileSnapshot | null;
}

export interface AvatarMeasurements {
  height: number | null;     // cm
  weightKg: number | null;   // kg
  bust: number | null;       // cm
  waist: number | null;      // cm
  hips: number | null;       // cm
  inseam: number | null;     // cm
  shoulderWidth: number | null; // cm
  sleeveLength: number | null;  // cm
  neck: number | null;          // cm
  chest: number | null;         // cm
  thigh: number | null;         // cm
  rise: number | null;          // cm
}

export interface FitResultSummary {
  skuId: string;
  garmentName: string;
  brandName: string;
  recommendedSize: string | null;
  fitScore: number | null;
  fitLabel: "perfect" | "good" | "ok" | "poor" | null;
  renderUrl: string | null;
  createdAt: string;
}

export interface TasteProfileSnapshot {
  favouriteCategories: string[];
  favouriteColours: string[];
  preferredFitKeywords: string[];
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  totalSignals: number;
  lastUpdated: string;
}

// ─────────────────────────────────────────────
// Fit recommendation
// ─────────────────────────────────────────────

export interface FitRecommendationRequest {
  avatarId: string;
  skuId: string;
  sizeChartId?: string; // optional — if brand has a size chart in the system
  sizeChart?: SizeChartData; // or pass inline
}

export interface SizeChartData {
  brand: string;
  category: string;
  sizeSystem: string; // AU, US, EU, INT
  rows: SizeChartRow[];
}

export interface SizeChartRow {
  size: string;
  bustMin?: number;
  bustMax?: number;
  waistMin?: number;
  waistMax?: number;
  hipsMin?: number;
  hipsMax?: number;
  inseamMin?: number;
  inseamMax?: number;
  shoulderMin?: number;
  shoulderMax?: number;
}

export interface FitRecommendationResult {
  avatarId: string;
  skuId: string;
  recommendedSize: string;
  alternativeSize: string | null;
  fitScore: number; // 0–1
  fitLabel: "perfect" | "good" | "ok" | "poor";
  confidence: number; // 0–1, how confident we are in the recommendation
  measurementGaps: string[]; // measurements used / missing from avatar
  sizeBreakdown: SizeBreakdown[];
  message: string; // human-readable recommendation summary
}

export interface SizeBreakdown {
  size: string;
  totalScore: number; // 0–1 composite
  measurementFits: MeasurementFit[];
}

export interface MeasurementFit {
  measurement: string; // "bust", "waist" etc
  avatarValue: number;
  sizeMin: number;
  sizeMax: number;
  fit: "within" | "slightly_tight" | "tight" | "slightly_loose" | "loose";
  delta: number; // avatar - midpoint; negative = smaller than midpoint
}

// ─────────────────────────────────────────────
// Size chart (stored in DB, per brand/garment)
// ─────────────────────────────────────────────

export interface StoredSizeChart {
  id: string;
  brandId: string;
  garmentId: string | null;
  name: string;
  category: string;
  sizeSystem: string;
  rows: SizeChartRow[];
  createdAt: string;
}

// ─────────────────────────────────────────────
// Taste signal
// ─────────────────────────────────────────────

export type TasteSignalType =
  | "product_view"
  | "product_like"
  | "product_save"
  | "backing_placed"
  | "size_selected"
  | "style_quiz_answer"
  | "campaign_browsed"
  | "manufacturer_viewed"
  | "search_query";

export interface TasteSignalInput {
  userId: string;
  avatarId?: string;
  signalType: TasteSignalType;
  entityId?: string;    // campaignId, skuId, garmentId etc
  entityType?: string;  // "campaign", "sku", "garment"
  payload?: Record<string, unknown>; // flexible signal data
  sessionId?: string;
}

// ─────────────────────────────────────────────
// Body shape calculator result
// ─────────────────────────────────────────────

export type BodyShape =
  | "hourglass"
  | "pear"
  | "apple"
  | "rectangle"
  | "inverted_triangle"
  | "unknown";

export interface BodyShapeResult {
  shape: BodyShape;
  confidence: number;
  description: string;
  fitTips: string[];
}

// ─────────────────────────────────────────────
// Avatar creation steps (frontend state)
// ─────────────────────────────────────────────

export type AvatarCreationStep =
  | "method"      // how will you measure?
  | "basics"      // height, weight
  | "upper"       // bust, shoulder, sleeve
  | "waist"       // waist, chest
  | "lower"       // hips, inseam, thigh, rise
  | "style"       // body shape confirm, fit preference
  | "preview"     // show body shape, size estimates
  | "complete";

export const AVATAR_STEPS: AvatarCreationStep[] = [
  "method",
  "basics",
  "upper",
  "waist",
  "lower",
  "style",
  "preview",
  "complete",
];

export const MEASUREMENT_METHOD_LABELS: Record<string, string> = {
  manual:    "I'll measure myself with a tape",
  estimated: "I'll estimate based on my clothing sizes",
  scan:      "Scan from photo (coming soon)",
};

export const FIT_PREFERENCE_LABELS: Record<string, string> = {
  slim:      "Slim — I like it close to my body",
  regular:   "Regular — true to size, relaxed through the body",
  relaxed:   "Relaxed — I prefer a little room",
  oversized: "Oversized — I love a big, boxy fit",
};

export const BODY_SHAPE_DESCRIPTIONS: Record<BodyShape, { label: string; description: string; icon: string }> = {
  hourglass: {
    label: "Hourglass",
    description: "Bust and hips roughly equal, defined waist",
    icon: "⌛",
  },
  pear: {
    label: "Pear",
    description: "Hips wider than bust, narrower shoulders",
    icon: "🍐",
  },
  apple: {
    label: "Apple",
    description: "Fuller through the middle, slimmer legs",
    icon: "🍎",
  },
  rectangle: {
    label: "Rectangle",
    description: "Bust, waist and hips roughly the same width",
    icon: "▭",
  },
  inverted_triangle: {
    label: "Inverted Triangle",
    description: "Shoulders and bust wider than hips",
    icon: "▽",
  },
  unknown: {
    label: "Not sure yet",
    description: "Add more measurements for a body shape estimate",
    icon: "◯",
  },
};
