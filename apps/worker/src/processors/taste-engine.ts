/**
 * Taste Engine worker processor.
 *
 * Processes raw taste signals into synthesised TastePreferenceModel records.
 *
 * Architecture:
 * - Each signal write to TasteSignal also enqueues a "process-taste-signals" job
 *   debounced per-user (so rapid browsing = 1 aggregation job, not 100)
 * - This processor: reads unprocessed signals, updates the preference model,
 *   marks signals as processed
 * - Model rebuilds from scratch every 7 days OR when 100+ new signals accumulate
 * - Signal weights: backing (5) > like/save (3) > size_selected (3) > quiz_answer (2) > view (1)
 *
 * Output (TastePreferenceModel) drives:
 * - Campaign discovery sorting for that user
 * - Size pre-selection on campaign pages
 * - Stylist matching
 * - Fashion Intelligence aggregate reports (cross-user analysis)
 */

import { Worker, type ConnectionOptions } from "bullmq";
import { redis } from "../lib/redis";
import { prisma, Prisma, Decimal } from "../lib/database";

// ─────────────────────────────────────────────
// Signal type weights
// ─────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
  backing_placed:      5,
  product_like:        3,
  product_save:        3,
  size_selected:       3,
  style_quiz_answer:   2,
  campaign_browsed:    1,
  product_view:        1,
  manufacturer_viewed: 0.5,
  search_query:        0.5,
};

// ─────────────────────────────────────────────
// Score accumulator types
// ─────────────────────────────────────────────

interface CategoryScore {
  category: string;
  score: number;
  count: number;
}

interface ColourScore {
  colour: string;
  score: number;
  count: number;
}

interface BrandScore {
  brandId: string;
  brandName: string;
  score: number;
}

interface PriceAccumulator {
  totalMinCents: number;
  totalMaxCents: number;
  count: number;
}

// ─────────────────────────────────────────────
// Aggregation engine
// ─────────────────────────────────────────────

/**
 * Process all unprocessed taste signals for a user and upsert their preference model.
 * Can be called for a full rebuild (ignores processedAt) or incremental (new signals only).
 */
async function processUserSignals(userId: string, fullRebuild = false): Promise<void> {
  // For full rebuilds, take all signals. For incremental, only unprocessed.
  const whereClause = fullRebuild
    ? { userId }
    : { userId, processedAt: null };

  const signals = await prisma.tasteSignal.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
    take: 2000, // Cap at 2000 signals per run to keep latency bounded
  });

  if (signals.length === 0) return;

  // ── Accumulate scores from signals ────────────────────────────────────────

  const categories = new Map<string, CategoryScore>();
  const colours = new Map<string, ColourScore>();
  const brands = new Map<string, BrandScore>();
  const priceAcc: PriceAccumulator = { totalMinCents: 0, totalMaxCents: 0, count: 0 };
  const keywordSet = new Set<string>();
  const occasionSet = new Set<string>();
  const fitKeywordSet = new Set<string>();
  const sizeConfirmations = new Map<string, number>();

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.signalType] ?? 1;
    const payload = signal.payload as Record<string, unknown> | null;

    // ── Category signal ────────────────────────────────────────────────────
    const category = payload?.category as string | undefined;
    if (category) {
      const existing = categories.get(category) ?? { category, score: 0, count: 0 };
      existing.score += weight;
      existing.count += 1;
      categories.set(category, existing);
    }

    // ── Colour signal ──────────────────────────────────────────────────────
    const colour = payload?.colour as string | undefined;
    if (colour) {
      const norm = colour.toLowerCase().trim();
      const existing = colours.get(norm) ?? { colour: norm, score: 0, count: 0 };
      existing.score += weight;
      existing.count += 1;
      colours.set(norm, existing);
    }

    // ── Brand signal ───────────────────────────────────────────────────────
    const brandId = payload?.brandId as string | undefined;
    const brandName = payload?.brandName as string | undefined;
    if (brandId && brandName) {
      const existing = brands.get(brandId) ?? { brandId, brandName, score: 0 };
      existing.score += weight;
      brands.set(brandId, existing);
    }

    // ── Price signals ──────────────────────────────────────────────────────
    const priceCents = payload?.priceCents as number | undefined;
    if (priceCents && priceCents > 0) {
      // Backing a campaign at a price is the strongest price signal
      if (signal.signalType === "backing_placed") {
        priceAcc.totalMinCents += Math.round(priceCents * 0.6); // assume backing = ~60% of retail
        priceAcc.totalMaxCents += priceCents;
        priceAcc.count += 1;
      } else if (signal.signalType === "product_view" || signal.signalType === "campaign_browsed") {
        priceAcc.totalMinCents += Math.round(priceCents * 0.5);
        priceAcc.totalMaxCents += Math.round(priceCents * 1.3);
        priceAcc.count += 1;
      }
    }

    // ── Style keywords from quiz ───────────────────────────────────────────
    if (signal.signalType === "style_quiz_answer") {
      const keywords = payload?.keywords as string[] | undefined;
      if (Array.isArray(keywords)) {
        for (const kw of keywords) {
          if (typeof kw === "string") keywordSet.add(kw.toLowerCase().trim());
        }
      }
      const occasions = payload?.occasions as string[] | undefined;
      if (Array.isArray(occasions)) {
        for (const occ of occasions) {
          if (typeof occ === "string") occasionSet.add(occ.toLowerCase().trim());
        }
      }
      const fitPref = payload?.fitPreference as string | undefined;
      if (fitPref) fitKeywordSet.add(fitPref);
    }

    // ── Fit preference from avatar ─────────────────────────────────────────
    const fitPreference = payload?.fitPreference as string | undefined;
    if (fitPreference && signal.signalType !== "style_quiz_answer") {
      fitKeywordSet.add(fitPreference);
    }

    // ── Size confirmation ──────────────────────────────────────────────────
    const confirmedSize = payload?.recommendedSize as string | undefined;
    if (confirmedSize && signal.signalType === "size_selected") {
      const current = sizeConfirmations.get(confirmedSize) ?? 0;
      sizeConfirmations.set(confirmedSize, current + 1);
    }
  }

  // ── Sort and rank accumulators ─────────────────────────────────────────────

  const topCategories = Array.from(categories.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const topColours = Array.from(colours.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const preferredBrands = Array.from(brands.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Price range — average of observed prices, capped to reasonable bounds
  const priceRangeMinCents = priceAcc.count > 0
    ? Math.max(1000, Math.round(priceAcc.totalMinCents / priceAcc.count))
    : null;
  const priceRangeMaxCents = priceAcc.count > 0
    ? Math.min(100000, Math.round(priceAcc.totalMaxCents / priceAcc.count))
    : null;

  // Confirmed size: most frequently confirmed
  let confirmedSizeAu: string | null = null;
  let maxSizeCount = 0;
  for (const [size, count] of sizeConfirmations.entries()) {
    if (count > maxSizeCount) {
      maxSizeCount = count;
      confirmedSizeAu = size;
    }
  }

  // Model quality: increases with signal count and diversity
  const diversity = [
    topCategories.length > 0 ? 0.2 : 0,
    topColours.length > 0 ? 0.15 : 0,
    preferredBrands.length > 0 ? 0.15 : 0,
    keywordSet.size > 0 ? 0.1 : 0,
    confirmedSizeAu ? 0.2 : 0,
    priceAcc.count > 0 ? 0.2 : 0,
  ].reduce((a, b) => a + b, 0);

  const signalCountFactor = Math.min(1, signals.length / 50); // saturates at 50 signals
  const modelQuality = Math.min(0.99, diversity * signalCountFactor);

  // ── Get existing model to merge with ──────────────────────────────────────

  const existing = await prisma.tastePreferenceModel.findUnique({
    where: { userId },
  });

  const totalSignalCount = fullRebuild
    ? signals.length
    : (existing?.signalCount ?? 0) + signals.length;

  // ── Upsert the preference model ────────────────────────────────────────────

  await prisma.tastePreferenceModel.upsert({
    where: { userId },
    create: {
      userId,
      topCategories: topCategories as unknown as Prisma.InputJsonValue,
      topColours: topColours as unknown as Prisma.InputJsonValue,
      preferredBrands: preferredBrands as unknown as Prisma.InputJsonValue,
      priceRangeMinCents,
      priceRangeMaxCents,
      styleKeywords: Array.from(keywordSet),
      occasions: Array.from(occasionSet),
      fitKeywords: Array.from(fitKeywordSet),
      confirmedSizeAu,
      signalCount: totalSignalCount,
      signalsSinceRebuild: 0,
      modelQuality: new Decimal(modelQuality.toFixed(2)),
      lastBuiltAt: new Date(),
    },
    update: {
      topCategories: topCategories as unknown as Prisma.InputJsonValue,
      topColours: topColours as unknown as Prisma.InputJsonValue,
      preferredBrands: preferredBrands as unknown as Prisma.InputJsonValue,
      priceRangeMinCents: priceRangeMinCents ?? existing?.priceRangeMinCents,
      priceRangeMaxCents: priceRangeMaxCents ?? existing?.priceRangeMaxCents,
      // Merge keywords, deduplicate
      styleKeywords: Array.from(new Set([...(existing?.styleKeywords ?? []), ...keywordSet])).slice(0, 30),
      occasions: Array.from(new Set([...(existing?.occasions ?? []), ...occasionSet])).slice(0, 15),
      fitKeywords: Array.from(new Set([...(existing?.fitKeywords ?? []), ...fitKeywordSet])).slice(0, 10),
      confirmedSizeAu: confirmedSizeAu ?? existing?.confirmedSizeAu,
      signalCount: totalSignalCount,
      signalsSinceRebuild: 0,
      modelQuality: new Decimal(modelQuality.toFixed(2)),
      lastBuiltAt: new Date(),
    },
  });

  // ── Mark signals as processed ──────────────────────────────────────────────

  const processedAt = new Date();
  await prisma.tasteSignal.updateMany({
    where: {
      userId,
      id: { in: signals.map((s) => s.id) },
    },
    data: { processedAt },
  });
}

/**
 * Check if a full rebuild is warranted.
 * Conditions: model is 7+ days old OR 100+ unprocessed signals since last rebuild.
 */
async function shouldFullRebuild(userId: string): Promise<boolean> {
  const model = await prisma.tastePreferenceModel.findUnique({ where: { userId } });
  if (!model) return true; // Never been built

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (model.lastBuiltAt < sevenDaysAgo) return true;
  if (model.signalsSinceRebuild >= 100) return true;

  return false;
}

// ─────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────

export interface TasteEngineJobData {
  userId: string;
  forceRebuild?: boolean;
}

export const tasteEngineWorker = new Worker<TasteEngineJobData>(
  "taste-engine",
  async (job) => {
    const { userId, forceRebuild = false } = job.data;
    job.log(`Processing taste signals for user: ${userId} (forceRebuild=${forceRebuild})`);

    const fullRebuild = forceRebuild || await shouldFullRebuild(userId);
    await processUserSignals(userId, fullRebuild);

    return { userId, fullRebuild, processedAt: new Date().toISOString() };
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 5,
    // Don't overload the DB with too many concurrent signal-processing runs
    limiter: {
      max: 20,
      duration: 1000,
    },
  },
);

tasteEngineWorker.on("completed", (job) => {
  console.info(`[taste-engine] Job ${job.id} completed for user ${job.data.userId}`);
});

tasteEngineWorker.on("failed", (job, err) => {
  console.error(`[taste-engine] Job ${job?.id} failed for user ${job?.data.userId}:`, err.message);
});

export default tasteEngineWorker;
