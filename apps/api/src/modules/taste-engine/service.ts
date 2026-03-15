/**
 * Taste Engine service layer.
 *
 * Provides read access to synthesised user preference models
 * and writes RLHF feedback signals.
 *
 * The actual preference model construction happens in the worker
 * (apps/worker/src/processors/taste-engine.ts).
 * This service just reads the output and exposes it via API.
 */

import { prisma, Prisma } from "@loocbooc/database";
import { enqueueTasteEngineJob } from "../../lib/queues.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TasteProfile {
  userId: string;
  topCategories: Array<{ category: string; score: number; count: number }>;
  topColours: Array<{ colour: string; score: number; count: number }>;
  preferredBrands: Array<{ brandId: string; brandName: string; score: number }>;
  priceRangeMinCents: number | null;
  priceRangeMaxCents: number | null;
  styleKeywords: string[];
  occasions: string[];
  fitKeywords: string[];
  confirmedSizeAu: string | null;
  signalCount: number;
  modelQuality: number;
  lastBuiltAt: string;
  // Human-readable summary
  summary: TasteProfileSummary;
}

export interface TasteProfileSummary {
  topCategories: string[];     // just the names
  topColours: string[];        // just the names
  preferredSizeAu: string | null;
  priceRange: string | null;   // e.g. "$80–$150"
  hasEnoughData: boolean;      // true if modelQuality >= 0.25
  insightsAvailable: number;   // count of non-empty data points
}

export interface CampaignRecommendation {
  campaignId: string;
  title: string;
  brandName: string;
  coverImageUrl: string | null;
  backerPriceCents: number;
  currency: string;
  currentBackingCount: number;
  moq: number;
  availableSizes: string[];
  relevanceScore: number;  // 0–1, how well this matches the taste profile
  relevanceReasons: string[];  // human-readable explanation
  recommendedSize: string | null; // pre-selected from avatar + taste model
}

// ─────────────────────────────────────────────
// Get taste profile
// ─────────────────────────────────────────────

export async function getTasteProfile(userId: string): Promise<TasteProfile | null> {
  const model = await prisma.tastePreferenceModel.findUnique({
    where: { userId },
  });

  if (!model) {
    // No profile yet — trigger a build and return null
    void enqueueTasteEngineJob(userId, { immediate: true });
    return null;
  }

  const topCategories = model.topCategories as Array<{ category: string; score: number; count: number }>;
  const topColours = model.topColours as Array<{ colour: string; score: number; count: number }>;
  const preferredBrands = model.preferredBrands as Array<{ brandId: string; brandName: string; score: number }>;
  const modelQuality = Number(model.modelQuality);

  // Build human-readable price range
  let priceRange: string | null = null;
  if (model.priceRangeMinCents && model.priceRangeMaxCents) {
    const min = Math.round(model.priceRangeMinCents / 100);
    const max = Math.round(model.priceRangeMaxCents / 100);
    priceRange = `$${min}–$${max}`;
  }

  // Count available insights
  let insightsAvailable = 0;
  if (topCategories.length > 0) insightsAvailable++;
  if (topColours.length > 0) insightsAvailable++;
  if (preferredBrands.length > 0) insightsAvailable++;
  if (model.confirmedSizeAu) insightsAvailable++;
  if (model.priceRangeMinCents) insightsAvailable++;
  if (model.styleKeywords.length > 0) insightsAvailable++;

  return {
    userId,
    topCategories,
    topColours,
    preferredBrands,
    priceRangeMinCents: model.priceRangeMinCents,
    priceRangeMaxCents: model.priceRangeMaxCents,
    styleKeywords: model.styleKeywords,
    occasions: model.occasions,
    fitKeywords: model.fitKeywords,
    confirmedSizeAu: model.confirmedSizeAu,
    signalCount: model.signalCount,
    modelQuality,
    lastBuiltAt: model.lastBuiltAt.toISOString(),
    summary: {
      topCategories: topCategories.slice(0, 3).map((c) => c.category),
      topColours: topColours.slice(0, 3).map((c) => c.colour),
      preferredSizeAu: model.confirmedSizeAu,
      priceRange,
      hasEnoughData: modelQuality >= 0.25,
      insightsAvailable,
    },
  };
}

// ─────────────────────────────────────────────
// Campaign recommendations
// ─────────────────────────────────────────────

/**
 * Return active campaigns sorted by relevance to the user's taste profile.
 * Falls back to chronological sort if no profile exists.
 */
export async function getPersonalisedCampaigns(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<{ campaigns: CampaignRecommendation[]; totalCount: number; isPersonalised: boolean }> {
  const model = await prisma.tastePreferenceModel.findUnique({ where: { userId } });

  // Fetch active campaigns
  const [allCampaigns, totalCount] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: "active" },
      include: {
        brand: { select: { name: true } },
        garment: { select: { category: true, tags: true } },
      },
      orderBy: { campaignStart: "desc" },
      take: Math.min(limit * 3, 100), // Fetch more to re-rank
      skip: model ? 0 : offset, // Skip only when not re-ranking
    }),
    prisma.campaign.count({ where: { status: "active" } }),
  ]);

  if (!model || Number(model.modelQuality) < 0.1) {
    // No taste model — return chronological
    const campaigns = allCampaigns.slice(offset, offset + limit).map((c) => ({
      campaignId: c.id,
      title: c.title,
      brandName: c.brand.name,
      coverImageUrl: c.coverImageUrl,
      backerPriceCents: c.backerPriceCents,
      currency: c.currency,
      currentBackingCount: c.currentBackingCount,
      moq: c.moq,
      availableSizes: c.availableSizes,
      relevanceScore: 0,
      relevanceReasons: [],
      recommendedSize: null,
    }));
    return { campaigns, totalCount, isPersonalised: false };
  }

  const topCategories = model.topCategories as Array<{ category: string; score: number }>;
  const preferredBrands = model.preferredBrands as Array<{ brandId: string; score: number }>;
  const categoryMap = new Map(topCategories.map((c) => [c.category.toLowerCase(), c.score]));
  const brandMap = new Map(preferredBrands.map((b) => [b.brandId, b.score]));

  // Score each campaign
  const scored = allCampaigns.map((campaign) => {
    let score = 0;
    const reasons: string[] = [];

    // Category match
    const category = campaign.garment.category?.toLowerCase();
    if (category && categoryMap.has(category)) {
      const catScore = categoryMap.get(category)!;
      score += Math.min(catScore / 10, 0.4); // max 0.4 from category
      reasons.push(`Matches your interest in ${category}`);
    }

    // Brand match
    if (brandMap.has(campaign.brandId)) {
      const brandScore = brandMap.get(campaign.brandId)!;
      score += Math.min(brandScore / 10, 0.3); // max 0.3 from brand
      reasons.push(`From a brand you like`);
    }

    // Price range match
    const price = campaign.backerPriceCents;
    if (model.priceRangeMinCents && model.priceRangeMaxCents) {
      const inRange = price >= model.priceRangeMinCents * 0.7 && price <= model.priceRangeMaxCents * 1.3;
      if (inRange) {
        score += 0.2;
        reasons.push("Within your price range");
      }
    }

    // Tag match from style keywords
    if (model.styleKeywords.length > 0) {
      const tags = campaign.garment.tags.map((t) => t.toLowerCase());
      const matchedKeywords = model.styleKeywords.filter((kw) => tags.includes(kw));
      if (matchedKeywords.length > 0) {
        score += Math.min(matchedKeywords.length * 0.05, 0.1);
        reasons.push(`Matches your style interests`);
      }
    }

    // Boost near-MOQ campaigns slightly (social proof + urgency)
    const moqProgress = campaign.currentBackingCount / campaign.moq;
    if (moqProgress >= 0.7) {
      score += 0.05;
      reasons.push(`Nearly funded (${Math.round(moqProgress * 100)}%)`);
    }

    // Recommended size from confirmed AU size
    let recommendedSize: string | null = null;
    if (model.confirmedSizeAu && campaign.availableSizes.includes(model.confirmedSizeAu)) {
      recommendedSize = model.confirmedSizeAu;
    }

    return {
      campaign,
      relevanceScore: Math.min(score, 1),
      relevanceReasons: reasons,
      recommendedSize,
    };
  });

  // Sort by relevance score
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const paginated = scored.slice(offset, offset + limit).map(({ campaign, relevanceScore, relevanceReasons, recommendedSize }) => ({
    campaignId: campaign.id,
    title: campaign.title,
    brandName: campaign.brand.name,
    coverImageUrl: campaign.coverImageUrl,
    backerPriceCents: campaign.backerPriceCents,
    currency: campaign.currency,
    currentBackingCount: campaign.currentBackingCount,
    moq: campaign.moq,
    availableSizes: campaign.availableSizes,
    relevanceScore,
    relevanceReasons,
    recommendedSize,
  }));

  return { campaigns: paginated, totalCount, isPersonalised: true };
}

// ─────────────────────────────────────────────
// RLHF feedback
// ─────────────────────────────────────────────

export async function recordRLHFFeedback(
  userId: string,
  input: {
    entityId: string;
    entityType: string;
    feedback: string;
    context?: string;
    recommendationId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.rLHFFeedback.create({
    data: {
      userId,
      entityId: input.entityId,
      entityType: input.entityType,
      feedback: input.feedback,
      context: input.context ?? null,
      recommendationId: input.recommendationId ?? null,
      payload: (input.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  // Strong RLHF signals (purchased, thumbs_down) trigger immediate taste engine rebuild
  if (input.feedback === "purchased" || input.feedback === "thumbs_down") {
    void enqueueTasteEngineJob(userId, { immediate: true });
  } else {
    void enqueueTasteEngineJob(userId);
  }
}

// ─────────────────────────────────────────────
// Signal count (for profile completeness indicator)
// ─────────────────────────────────────────────

export async function getUserSignalCount(userId: string): Promise<number> {
  return prisma.tasteSignal.count({ where: { userId } });
}

// ─────────────────────────────────────────────
// Force rebuild (admin/dev endpoint)
// ─────────────────────────────────────────────

export async function forceRebuildProfile(userId: string): Promise<void> {
  await enqueueTasteEngineJob(userId, { immediate: true, forceRebuild: true });
}
