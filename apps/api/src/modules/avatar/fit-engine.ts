/**
 * Fit recommendation engine.
 *
 * Converts avatar measurements + a brand size chart into a specific size
 * recommendation with a confidence score.
 *
 * Design principles:
 * - Pure function — no side effects, no DB calls. Service layer handles persistence.
 * - Priority-weighted: bust/waist/hips matter more than shoulder/inseam for tops.
 * - Missing measurements degrade confidence but never block a recommendation.
 * - Fit preference (slim/regular/relaxed/oversized) adjusts the scoring weights.
 *
 * Scoring model:
 * 1. For each size in the chart, compute a per-measurement fit score (0–1).
 * 2. Weight the measurements by category (bust-heavy for tops, hip-heavy for bottoms).
 * 3. Apply fit preference adjustment (slim→tighter range preferred, oversized→looser).
 * 4. The size with the highest weighted score is the recommendation.
 * 5. Confidence = f(number of matched measurements / total expected).
 */

import type {
  SizeChartData,
  SizeChartRow,
  FitRecommendationResult,
  SizeBreakdown,
  MeasurementFit,
  AvatarMeasurements,
  BodyShapeResult,
  BodyShape,
} from "./types.js";

// ─────────────────────────────────────────────
// Measurement weights per garment category
// ─────────────────────────────────────────────

type MeasurementKey = keyof AvatarMeasurements;

interface CategoryWeights {
  primary: MeasurementKey[];    // highest weight (3x)
  secondary: MeasurementKey[];  // medium weight (1.5x)
  tertiary: MeasurementKey[];   // low weight (0.5x)
}

const CATEGORY_WEIGHTS: Record<string, CategoryWeights> = {
  // Tops
  top: {
    primary: ["bust", "chest"],
    secondary: ["shoulderWidth", "waist"],
    tertiary: ["sleeveLength", "neck"],
  },
  blouse: {
    primary: ["bust", "chest"],
    secondary: ["shoulderWidth", "waist"],
    tertiary: ["sleeveLength"],
  },
  jacket: {
    primary: ["bust", "chest", "shoulderWidth"],
    secondary: ["waist", "sleeveLength"],
    tertiary: ["neck"],
  },
  coat: {
    primary: ["bust", "chest", "shoulderWidth"],
    secondary: ["waist", "sleeveLength"],
    tertiary: [],
  },
  // Bottoms
  trouser: {
    primary: ["waist", "hips"],
    secondary: ["inseam", "thigh"],
    tertiary: ["rise"],
  },
  pant: {
    primary: ["waist", "hips"],
    secondary: ["inseam", "thigh"],
    tertiary: ["rise"],
  },
  skirt: {
    primary: ["waist", "hips"],
    secondary: [],
    tertiary: [],
  },
  short: {
    primary: ["waist", "hips"],
    secondary: ["thigh"],
    tertiary: [],
  },
  // Dresses / jumpsuits
  dress: {
    primary: ["bust", "waist", "hips"],
    secondary: ["chest", "shoulderWidth"],
    tertiary: ["sleeveLength"],
  },
  jumpsuit: {
    primary: ["bust", "waist", "hips"],
    secondary: ["inseam", "shoulderWidth"],
    tertiary: ["rise"],
  },
  // Default
  default: {
    primary: ["bust", "waist", "hips"],
    secondary: ["chest", "shoulderWidth"],
    tertiary: ["inseam"],
  },
};

function getWeights(category: string): CategoryWeights {
  const normalised = category.toLowerCase().replace(/s$/, ""); // "trousers" → "trouser"
  return CATEGORY_WEIGHTS[normalised] ?? CATEGORY_WEIGHTS["default"]!;
}

// ─────────────────────────────────────────────
// Fit preference adjustment factors
// ─────────────────────────────────────────────

// When scoring, loosen or tighten the "perfect zone" based on preference.
// e.g., "oversized" → a measurement that falls below the size range is still OK.
const FIT_PREFERENCE_EASE: Record<string, number> = {
  slim:      -2,  // reduce all max values by 2cm before scoring
  regular:    0,
  relaxed:   +2,
  oversized: +4,
};

// ─────────────────────────────────────────────
// Core scoring functions
// ─────────────────────────────────────────────

/**
 * Score a single measurement against a size row.
 * Returns a value 0–1 where 1 = perfect fit, 0 = very far out.
 */
function scoreMeasurement(
  value: number,
  min: number | undefined,
  max: number | undefined,
  ease: number = 0,
): MeasurementFit & { score: number } {
  const adjustedMax = (max ?? Infinity) + ease;
  const adjustedMin = (min ?? 0) + ease * 0.5; // ease mostly affects max

  if (value >= adjustedMin && value <= adjustedMax) {
    // Perfect fit — score by proximity to midpoint (centre of range is best)
    const mid = (adjustedMin + adjustedMax) / 2;
    const rangeHalf = (adjustedMax - adjustedMin) / 2;
    const distanceFromMid = Math.abs(value - mid);
    const score = rangeHalf > 0 ? 1 - (distanceFromMid / rangeHalf) * 0.1 : 1; // 0.9–1.0

    const safeMin = min ?? 0;
    const safeMax = max ?? 0;
    return {
      measurement: "",
      avatarValue: value,
      sizeMin: safeMin,
      sizeMax: safeMax,
      fit: "within",
      delta: value - (safeMin + safeMax) / 2,
      score,
    };
  }

  const safeMin = min ?? 0;
  const safeMax = max ?? 0;
  const mid = (safeMin + safeMax) / 2;
  const delta = value - mid;

  if (value < adjustedMin) {
    // Avatar is smaller than this size
    const gap = adjustedMin - value;
    const score = Math.max(0, 1 - gap / 10); // lose 0.1 per cm outside range
    return {
      measurement: "",
      avatarValue: value,
      sizeMin: safeMin,
      sizeMax: safeMax,
      fit: gap <= 2 ? "slightly_loose" : "loose",
      delta,
      score,
    };
  } else {
    // Avatar is larger than this size
    const gap = value - adjustedMax;
    const score = Math.max(0, 1 - gap / 10);
    return {
      measurement: "",
      avatarValue: value,
      sizeMin: safeMin,
      sizeMax: safeMax,
      fit: gap <= 2 ? "slightly_tight" : "tight",
      delta,
      score,
    };
  }
}

/**
 * Score all measurements for one size row.
 * Returns weighted composite score (0–1) and per-measurement breakdown.
 */
function scoreRow(
  row: SizeChartRow,
  measurements: AvatarMeasurements,
  weights: CategoryWeights,
  ease: number,
): { totalScore: number; measurementFits: MeasurementFit[]; measuredCount: number } {
  const fits: MeasurementFit[] = [];
  let weightedScore = 0;
  let totalWeight = 0;
  let measuredCount = 0;

  // Map measurement keys to row fields — chest uses bust values as fallback
  const measurementMap: Record<string, { min: number | null; max: number | null }> = {
    bust:          { min: row.bustMin ?? null,     max: row.bustMax ?? null },
    chest:         { min: row.bustMin ?? null,     max: row.bustMax ?? null }, // use bust as proxy for chest
    waist:         { min: row.waistMin ?? null,    max: row.waistMax ?? null },
    hips:          { min: row.hipsMin ?? null,     max: row.hipsMax ?? null },
    inseam:        { min: row.inseamMin ?? null,   max: row.inseamMax ?? null },
    shoulderWidth: { min: row.shoulderMin ?? null, max: row.shoulderMax ?? null },
  };

  function scoreOne(key: MeasurementKey, weight: number) {
    const value = measurements[key];
    const range = measurementMap[key];
    if (!range) return;

    if (value === null || value === undefined) {
      // Missing measurement — treat as partial contribution (0.5)
      totalWeight += weight * 0.5;
      weightedScore += weight * 0.5 * 0.5; // half weight, neutral score
      return;
    }

    const numValue = typeof value === "object" ? Number(value) : value as number;
    const { min, max } = range;

    if (min == null && max == null) {
      // Size chart doesn't have this measurement — skip
      return;
    }

    measuredCount++;
    const result = scoreMeasurement(numValue, min ?? undefined, max ?? undefined, ease);
    result.measurement = key;
    fits.push(result);
    weightedScore += weight * result.score;
    totalWeight += weight;
  }

  // Apply weights
  for (const key of weights.primary) {
    scoreOne(key, 3);
  }
  for (const key of weights.secondary) {
    scoreOne(key, 1.5);
  }
  for (const key of weights.tertiary) {
    scoreOne(key, 0.5);
  }

  const totalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return { totalScore, measurementFits: fits, measuredCount };
}

// ─────────────────────────────────────────────
// Body shape calculator
// ─────────────────────────────────────────────

export function calculateBodyShape(measurements: AvatarMeasurements): BodyShapeResult {
  const bust = measurements.bust ? Number(measurements.bust) : null;
  const waist = measurements.waist ? Number(measurements.waist) : null;
  const hips = measurements.hips ? Number(measurements.hips) : null;
  const shoulder = measurements.shoulderWidth ? Number(measurements.shoulderWidth) : null;

  if (!bust || !waist || !hips) {
    return {
      shape: "unknown",
      confidence: 0,
      description: "Add bust, waist, and hip measurements for a body shape estimate.",
      fitTips: [],
    };
  }

  const bustHipDiff = Math.abs(bust - hips);
  const waistBust = bust - waist;
  const waistHip = hips - waist;

  let shape: BodyShape;
  let confidence = 0.75;

  if (bustHipDiff <= 5 && waistBust >= 9 && waistHip >= 9) {
    shape = "hourglass";
    confidence = 0.9;
  } else if (hips - bust >= 5) {
    shape = "pear";
    confidence = 0.85;
  } else if (bust - hips >= 5 || (shoulder && shoulder - hips >= 5)) {
    shape = "inverted_triangle";
    confidence = 0.85;
  } else if (waistBust < 7 && waistHip < 7) {
    shape = "rectangle";
    confidence = 0.80;
  } else {
    shape = "apple";
    confidence = 0.70;
  }

  const tips: Record<BodyShape, string[]> = {
    hourglass: [
      "Fitted waists define your silhouette beautifully",
      "Wrap dresses and belted styles work perfectly on you",
      "Avoid boxy cuts that hide your shape",
    ],
    pear: [
      "A-line and fit-and-flare styles balance your proportions",
      "Draw attention upward with interesting necklines",
      "Dark bottoms and lighter tops create visual balance",
    ],
    apple: [
      "Empire waists and flowy fabrics are flattering",
      "V-necks elongate the torso",
      "Avoid tight waistbands — opt for stretch or elastic",
    ],
    rectangle: [
      "Create curves with peplum tops and full skirts",
      "Belts and defined waists add shape",
      "Ruffles, draping, and texture add visual interest",
    ],
    inverted_triangle: [
      "A-line and full skirts balance wider shoulders",
      "Avoid shoulder pads and boat necks",
      "Wide-leg trousers create visual balance",
    ],
    unknown: [],
  };

  return {
    shape,
    confidence,
    description: `Your measurements suggest a ${shape.replace("_", " ")} body shape.`,
    fitTips: tips[shape],
  };
}

// ─────────────────────────────────────────────
// Main recommendation function
// ─────────────────────────────────────────────

export function recommendFit(
  measurements: AvatarMeasurements,
  sizeChart: SizeChartData,
  fitPreference: string = "regular",
): FitRecommendationResult {
  const weights = getWeights(sizeChart.category);
  const ease = FIT_PREFERENCE_EASE[fitPreference] ?? 0;

  const breakdowns: SizeBreakdown[] = [];
  let maxScore = -1;
  let bestSize = sizeChart.rows[0]?.size ?? "M";
  let totalMeasuredCount = 0;
  const expectedMeasurements = [...weights.primary, ...weights.secondary, ...weights.tertiary];

  for (const row of sizeChart.rows) {
    const { totalScore, measurementFits, measuredCount } = scoreRow(row, measurements, weights, ease);
    totalMeasuredCount = Math.max(totalMeasuredCount, measuredCount);

    breakdowns.push({
      size: row.size,
      totalScore,
      measurementFits,
    });

    if (totalScore > maxScore) {
      maxScore = totalScore;
      bestSize = row.size;
    }
  }

  // Find second-best for "consider also" suggestion
  const sorted = [...breakdowns].sort((a, b) => b.totalScore - a.totalScore);
  const alternativeSize =
    sorted[1] && sorted[0] && sorted[0].totalScore - sorted[1].totalScore < 0.1
      ? sorted[1].size
      : null;

  // Confidence based on how many measurements we actually had data for
  const totalExpected = expectedMeasurements.filter((key) => {
    // Check if the size chart even has this measurement
    const firstRow = sizeChart.rows[0];
    if (!firstRow) return false;
    const measurementMap: Record<string, boolean> = {
      bust:          firstRow.bustMin !== undefined || firstRow.bustMax !== undefined,
      chest:         firstRow.bustMin !== undefined || firstRow.bustMax !== undefined, // chest uses bust as proxy
      waist:         firstRow.waistMin !== undefined || firstRow.waistMax !== undefined,
      hips:          firstRow.hipsMin !== undefined || firstRow.hipsMax !== undefined,
      inseam:        firstRow.inseamMin !== undefined || firstRow.inseamMax !== undefined,
      shoulderWidth: firstRow.shoulderMin !== undefined || firstRow.shoulderMax !== undefined,
    };
    return measurementMap[key] ?? false;
  }).length;

  const confidence = totalExpected > 0 ? Math.min(1, totalMeasuredCount / totalExpected) : 0.5;

  // Fit label
  const fitLabel =
    maxScore >= 0.9 ? "perfect" :
    maxScore >= 0.75 ? "good" :
    maxScore >= 0.55 ? "ok" :
    "poor";

  // Identify which measurements were missing from avatar
  const measurementGaps: string[] = [];
  const bestBreakdown = sorted[0];
  if (bestBreakdown) {
    const coveredMeasurements = new Set(bestBreakdown.measurementFits.map((m) => m.measurement));
    for (const key of expectedMeasurements) {
      const val = measurements[key];
      if ((val === null || val === undefined) && !coveredMeasurements.has(key)) {
        measurementGaps.push(key);
      }
    }
  }

  // Human-readable message
  const sizeDesc = fitPreference === "oversized"
    ? "with an oversized fit"
    : fitPreference === "relaxed"
    ? "with a relaxed fit"
    : fitPreference === "slim"
    ? "with a slim fit"
    : "";

  const message = fitLabel === "perfect"
    ? `Size ${bestSize} looks like a perfect fit ${sizeDesc}.`.trim()
    : fitLabel === "good"
    ? `We recommend size ${bestSize} ${sizeDesc} — a good fit based on your measurements.`.trim()
    : fitLabel === "ok"
    ? `Size ${bestSize} should work ${sizeDesc}, though you may want to check the measurements.`.trim()
    : `Fit confidence is low — try size ${bestSize} and consider your usual preference.`.trim();

  return {
    avatarId: "",   // filled in by service layer
    skuId: "",      // filled in by service layer
    recommendedSize: bestSize,
    alternativeSize,
    fitScore: maxScore,
    fitLabel,
    confidence,
    measurementGaps,
    sizeBreakdown: breakdowns,
    message,
  };
}

// ─────────────────────────────────────────────
// Completion score helper
// ─────────────────────────────────────────────

const MEASUREMENT_FIELDS: (keyof AvatarMeasurements)[] = [
  "height", "weightKg", "bust", "waist", "hips",
  "inseam", "shoulderWidth", "sleeveLength", "neck",
  "chest", "thigh", "rise",
];

export function computeCompletionPercent(measurements: AvatarMeasurements): number {
  let filled = 0;
  for (const key of MEASUREMENT_FIELDS) {
    if (measurements[key] !== null && measurements[key] !== undefined) filled++;
  }
  return Math.round((filled / MEASUREMENT_FIELDS.length) * 100);
}

export function getConfidenceLabel(
  confidenceScore: number | null,
  completionPercent: number,
): "high" | "medium" | "low" | "uncalibrated" {
  if (confidenceScore === null) return "uncalibrated";
  if (confidenceScore >= 0.8 && completionPercent >= 60) return "high";
  if (confidenceScore >= 0.5 || completionPercent >= 30) return "medium";
  return "low";
}
