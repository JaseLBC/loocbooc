/**
 * Manufacturer Matching Algorithm — server-side only.
 *
 * Scoring weights are intentionally not exported. They never reach the client.
 * The client receives match scores (0–100) and human-readable reasons only.
 *
 * Factor weights:
 *   Specialisation match:    40%
 *   MOQ compatibility:       25%
 *   Certifications match:    20%
 *   Response time:           10%
 *   Rating:                   5%
 */

import { prisma, Prisma } from "@loocbooc/database";

type ManufacturerProfile = Prisma.ManufacturerProfileGetPayload<Record<string, never>>;
type ManufacturerRating = Prisma.ManufacturerRatingGetPayload<Record<string, never>>;
import type { ManufacturerProfileSummary, MatchedManufacturer, ManufacturerMatchResult } from "./types";
import { aggregateRatings } from "./service";

// ── Scoring weights (never exported) ─────────────────────────────────────────

const WEIGHTS = {
  specialisation: 0.40,
  moq: 0.25,
  certifications: 0.20,
  responseTime: 0.10,
  rating: 0.05,
} as const;

const TOP_N = 5;

// ── Brand signal inputs ───────────────────────────────────────────────────────

interface BrandSignals {
  specialisations: string[];
  moqNeeded: number;
  priceTier: string | null;
  exportMarkets: string[];
  certifications: string[];
  categories: string[];  // from recent PLM records
}

// ── Core scoring ──────────────────────────────────────────────────────────────

function scoreSpecialisation(
  profileSpecialisations: string[],
  brandSpecialisations: string[],
  brandCategories: string[],
): { score: number; matched: string[] } {
  if (brandSpecialisations.length === 0 && brandCategories.length === 0) {
    return { score: 0.5, matched: [] };
  }

  const allNeeded = [...new Set([...brandSpecialisations, ...brandCategories])].map(
    (s) => s.toLowerCase(),
  );
  const profileNorm = profileSpecialisations.map((s) => s.toLowerCase());

  const matched = allNeeded.filter((needed) =>
    profileNorm.some(
      (p) => p.includes(needed) || needed.includes(p),
    ),
  );

  const score = allNeeded.length > 0 ? matched.length / allNeeded.length : 0;
  return { score: Math.min(score, 1), matched };
}

function scoreMOQ(
  profileMoqMin: number,
  profileMoqMax: number | null,
  brandMoqNeeded: number,
): { score: number; compatible: boolean } {
  // Brand wants this MOQ — manufacturer must be able to accommodate it
  if (brandMoqNeeded === 0) return { score: 0.5, compatible: true };

  if (profileMoqMin > brandMoqNeeded) {
    // Manufacturer's minimum is higher than brand needs — not compatible
    // Partial credit if they're close (within 2x)
    const ratio = profileMoqMin / brandMoqNeeded;
    if (ratio <= 2) return { score: 0.3 * (1 - (ratio - 1)), compatible: false };
    return { score: 0, compatible: false };
  }

  if (profileMoqMax !== null && profileMoqMax < brandMoqNeeded) {
    // Manufacturer's maximum is below brand's needs
    const ratio = brandMoqNeeded / profileMoqMax;
    if (ratio <= 2) return { score: 0.3 * (1 - (ratio - 1)), compatible: false };
    return { score: 0, compatible: false };
  }

  // Brand's MOQ fits within the manufacturer's range — full score
  return { score: 1, compatible: true };
}

function scoreCertifications(
  profileCerts: string[],
  brandRequiredCerts: string[],
): { score: number; matched: string[] } {
  if (brandRequiredCerts.length === 0) return { score: 0.5, matched: [] };

  const profileNorm = profileCerts.map((c) => c.toLowerCase().replace(/[-_\s]/g, ""));
  const matched = brandRequiredCerts.filter((c) =>
    profileNorm.includes(c.toLowerCase().replace(/[-_\s]/g, "")),
  );

  return {
    score: matched.length / brandRequiredCerts.length,
    matched,
  };
}

function scoreResponseTime(responseTimeHours: number | null): number {
  if (responseTimeHours === null) return 0.3; // unknown — partial credit
  if (responseTimeHours <= 4) return 1.0;
  if (responseTimeHours <= 12) return 0.85;
  if (responseTimeHours <= 24) return 0.65;
  if (responseTimeHours <= 48) return 0.4;
  return 0.15;
}

function scoreRating(overallRating: number, totalReviews: number): number {
  if (totalReviews === 0) return 0.3; // unrated — partial credit (neutral)
  // Bayesian average: pull toward 3.0 for low-review-count manufacturers
  const confidence = Math.min(totalReviews / 10, 1);
  const adjusted = confidence * overallRating + (1 - confidence) * 3.0;
  return (adjusted - 1) / 4; // normalise 1–5 → 0–1
}

function buildMatchReasons(
  specMatched: string[],
  moqCompatible: boolean,
  certMatched: string[],
  responseTimeHours: number | null,
  overallRating: number,
  totalReviews: number,
): string[] {
  const reasons: string[] = [];

  if (specMatched.length > 0) {
    reasons.push(`Specialises in ${specMatched.slice(0, 3).join(", ")}`);
  }

  if (moqCompatible) {
    reasons.push("MOQ range matches your production needs");
  }

  if (certMatched.length > 0) {
    reasons.push(`Holds ${certMatched.slice(0, 2).join(", ")} certification${certMatched.length > 1 ? "s" : ""}`);
  }

  if (responseTimeHours !== null && responseTimeHours <= 12) {
    reasons.push("Fast response time (typically responds within 12 hours)");
  }

  if (totalReviews >= 3 && overallRating >= 4.0) {
    reasons.push(`Highly rated by brands (${overallRating.toFixed(1)}/5 from ${totalReviews} reviews)`);
  }

  return reasons.length > 0 ? reasons : ["Verified manufacturer in your category"];
}

// ── Main matching function ────────────────────────────────────────────────────

export async function getMatchedManufacturers(
  brandId: string,
): Promise<ManufacturerMatchResult> {
  // 1. Gather brand signals
  const signals = await gatherBrandSignals(brandId);

  // 2. Fetch all active, verified manufacturer profiles
  const profiles = await prisma.manufacturerProfile.findMany({
    where: {
      manufacturer: { active: true },
    },
    include: {
      manufacturer: true,
      ratings: true,
    },
  });

  if (profiles.length === 0) {
    return { matches: [], matchedAt: new Date() };
  }

  type ProfileWithRatings = ManufacturerProfile & { ratings: ManufacturerRating[]; manufacturer: { active: boolean } };

  // 3. Score each manufacturer
  const scored = profiles.map((profile: ProfileWithRatings) => {
    const ratingData = aggregateRatings(profile.ratings);

    // Specialisation
    const specResult = scoreSpecialisation(
      profile.specialisations,
      signals.specialisations,
      signals.categories,
    );

    // MOQ
    const moqResult = scoreMOQ(profile.moqMin, profile.moqMax, signals.moqNeeded);

    // Certifications
    const certResult = scoreCertifications(profile.certifications, signals.certifications);

    // Response time
    const rtScore = scoreResponseTime(profile.responseTimeHours);

    // Rating
    const ratingScore = scoreRating(ratingData.overall, ratingData.totalReviews);

    // Weighted composite score
    const composite =
      specResult.score * WEIGHTS.specialisation +
      moqResult.score * WEIGHTS.moq +
      certResult.score * WEIGHTS.certifications +
      rtScore * WEIGHTS.responseTime +
      ratingScore * WEIGHTS.rating;

    const matchScore = Math.round(composite * 100);

    const matchReasons = buildMatchReasons(
      specResult.matched,
      moqResult.compatible,
      certResult.matched,
      profile.responseTimeHours,
      ratingData.overall,
      ratingData.totalReviews,
    );

    const summary: ManufacturerProfileSummary = {
      id: profile.id,
      manufacturerId: profile.manufacturerId,
      displayName: profile.displayName,
      heroImageUrl: profile.heroImageUrl,
      country: profile.country,
      city: profile.city,
      moqMin: profile.moqMin,
      moqMax: profile.moqMax,
      sampleLeadTimeDays: profile.sampleLeadTimeDays,
      bulkLeadTimeDays: profile.bulkLeadTimeDays,
      specialisations: profile.specialisations,
      certifications: profile.certifications,
      priceTier: profile.priceTier,
      isVerified: profile.isVerified,
      isFeatured: profile.isFeatured,
      responseTimeHours: profile.responseTimeHours,
      ratings: ratingData,
    };

    const matched: MatchedManufacturer = {
      ...summary,
      matchScore,
      matchReasons,
    };

    return matched;
  });

  // 4. Sort by match score desc, take top N
  const matches = scored
    .sort((a: MatchedManufacturer, b: MatchedManufacturer) => b.matchScore - a.matchScore)
    .slice(0, TOP_N);

  return { matches, matchedAt: new Date() };
}

// ── Signal gathering ──────────────────────────────────────────────────────────

async function gatherBrandSignals(brandId: string): Promise<BrandSignals> {
  // Pull brand's recent PLM records to understand what they produce
  const recentPLM = await prisma.pLMRecord.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      brand: true,
    },
  });

  // Extract garment categories from PLM style names (heuristic)
  const categories = extractCategoriesFromPLM(recentPLM);

  // Pull brand's garments for category signals
  const garments = await prisma.garment.findMany({
    where: { brandId, status: { not: "discontinued" } },
    select: { category: true },
    take: 50,
  });

  const garmentCategories: string[] = garments
    .map((g: { category: string | null }) => g.category)
    .filter((c: string | null): c is string => c !== null);

  // Combine all category signals (deduped)
  const allCategories = [...new Set([...categories, ...garmentCategories])];

  // Check if brand has existing connections to infer priceTier preference
  const existingConnections = await prisma.brandManufacturerConnection.findMany({
    where: { brandId, status: { in: ["CONNECTED", "RESPONDED"] } },
    include: { manufacturerProfile: true },
    take: 5,
  });

  const priceTiers = existingConnections
    .map((c: typeof existingConnections[number]) => c.manufacturerProfile.priceTier)
    .filter(Boolean) as string[];

  const inferredPriceTier = priceTiers.length > 0
    ? mostCommon(priceTiers)
    : null;

  // Infer MOQ from recent campaigns
  const recentCampaigns = await prisma.campaign.findMany({
    where: { brandId, status: { in: ["funded", "in_production", "completed"] } },
    select: { moq: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const avgMoq = recentCampaigns.length > 0
    ? Math.round(
        recentCampaigns.reduce((sum: number, c: { moq: number }) => sum + c.moq, 0) / recentCampaigns.length,
      )
    : 100; // sensible default

  return {
    specialisations: allCategories,
    moqNeeded: avgMoq,
    priceTier: inferredPriceTier,
    exportMarkets: [],   // could be expanded via brand questionnaire data
    certifications: [],  // could be expanded via brand questionnaire data
    categories: allCategories,
  };
}

function extractCategoriesFromPLM(
  records: Array<{ styleName: string }>,
): string[] {
  const keywords = [
    "dress", "top", "blouse", "shirt", "trouser", "pant", "skirt",
    "jacket", "coat", "blazer", "knitwear", "denim", "jeans", "shorts",
    "suit", "swimwear", "lingerie", "activewear", "outerwear",
  ];

  const found = new Set<string>();
  for (const r of records) {
    const lower = r.styleName.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) found.add(kw);
    }
  }
  return [...found];
}

function mostCommon(arr: string[]): string {
  const freq = arr.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? arr[0] ?? "mid";
}
