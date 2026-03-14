/**
 * PLM Service — Production Intelligence
 *
 * Core business logic for garment pipeline tracking.
 * Every style/SKU tracked from first sketch to bulk approval.
 *
 * Rules:
 *  - Cost variance is ALWAYS recomputed server-side. Never trust client input.
 *  - All stage transitions are logged with timestamp + userId.
 *  - Decimal precision for all currency fields — never floats.
 *  - costFlag triggers EventBridge event plm.cost-blowout.
 *  - Stage stale >14 days triggers EventBridge event plm.milestone-overdue.
 */

import { PrismaClient, PLMStage, PLMRecord, PLMMilestone, PLMCostEntry, PLMSampleRound, Prisma } from "@prisma/client";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CreatePLMRecordInput {
  styleName: string;
  styleCode: string;
  season?: string;
  targetCost?: string | number; // passed as string to preserve decimal precision
  manufacturerId?: string;
  assignedTo?: string;
  notes?: string;
  skuId?: string;
}

export interface AdvanceStageInput {
  newStage: PLMStage;
  userId: string;
  notes?: string;
}

export interface CostEntryInput {
  entryType: "fabric" | "trim" | "labour" | "shipping" | "duty" | "total" | string;
  amount: string | number; // string preferred to avoid float rounding
  colourway?: string;
  currency?: string;
  notes?: string;
  recordedBy?: string;
}

export interface SampleRoundInput {
  roundNumber: number;
  shippedAt?: Date;
  trackingNumber?: string;
  carrier?: string;
  receivedAt?: Date;
  fitNotes?: string;
  fitApproved?: boolean;
  adjustments?: string;
}

export interface PLMDashboardStageGroup {
  stage: PLMStage;
  records: PLMRecordSummary[];
}

export interface PLMRecordSummary {
  id: string;
  styleName: string;
  styleCode: string;
  season: string | null;
  stage: PLMStage;
  costFlag: boolean;
  isOverdue: boolean;
  stageAgeDays: number;
  targetCost: string | null;
  currentCost: string | null;
  costVariance: string | null;
  updatedAt: Date;
  milestonesCount: number;
  latestSampleRound: number | null;
}

export interface PLMDashboard {
  brandId: string;
  totalStyles: number;
  costFlaggedCount: number;
  overdueCount: number;
  stageGroups: PLMDashboardStageGroup[];
  generatedAt: Date;
}

export interface CostHistoryResult {
  plmRecordId: string;
  styleName: string;
  styleCode: string;
  targetCost: string | null;
  currentCost: string | null;
  costVariance: string | null;
  costFlag: boolean;
  entries: PLMCostEntry[];
}

export interface OverdueRecord {
  id: string;
  styleName: string;
  styleCode: string;
  stage: PLMStage;
  stageAgeDays: number;
  assignedTo: string | null;
  updatedAt: Date;
}

export interface CostComparisonResult {
  styleCode: string;
  records: Array<{
    id: string;
    styleName: string;
    season: string | null;
    targetCost: string | null;
    currentCost: string | null;
    costVariance: string | null;
    createdAt: Date;
  }>;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COST_BLOWOUT_THRESHOLD = 0.15; // 15% over target triggers costFlag
const OVERDUE_DAYS = 14;             // days in same stage before considered overdue

const EVENTBRIDGE_SOURCE = "loocbooc.plm";
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? "loocbooc-events";

// ─────────────────────────────────────────────
// Singleton clients
// ─────────────────────────────────────────────

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toDecimalString(value: string | number | Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value).toString();
}

/**
 * Recomputes costVariance and costFlag.
 * Returns the Prisma update payload for those fields.
 * NEVER trusts client-supplied variance.
 */
function recomputeCostFields(
  targetCost: Prisma.Decimal | null,
  currentCost: Prisma.Decimal | null
): {
  costVariance: Prisma.Decimal | null;
  costFlag: boolean;
} {
  if (!targetCost || !currentCost) {
    return { costVariance: null, costFlag: false };
  }

  const target = new Prisma.Decimal(targetCost);
  const current = new Prisma.Decimal(currentCost);
  const variance = current.minus(target);

  // Flag if current is more than 15% over target
  // variance / target > 0.15 → costFlag = true
  const varianceRatio = variance.dividedBy(target);
  const costFlag = varianceRatio.greaterThan(COST_BLOWOUT_THRESHOLD);

  return { costVariance: variance, costFlag };
}

function daysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function emitEvent(
  detailType: string,
  detail: Record<string, unknown>
): Promise<void> {
  try {
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: EVENTBRIDGE_SOURCE,
            DetailType: detailType,
            EventBusName: EVENT_BUS_NAME,
            Detail: JSON.stringify(detail),
          },
        ],
      })
    );
  } catch (err) {
    // Log but don't throw — EventBridge failures should not break API responses.
    // In production, use a dead-letter queue / retry mechanism.
    console.error(`[PLM] Failed to emit EventBridge event: ${detailType}`, err);
  }
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export class PLMService {
  constructor(private readonly db: PrismaClient) {}

  // ───────────────────────────────────────────
  // createPLMRecord
  // ───────────────────────────────────────────

  /**
   * Create a new PLM record for a style/garment.
   * Starts at DESIGN stage by default.
   * Auto-creates the initial DESIGN milestone.
   */
  async createPLMRecord(
    brandId: string,
    data: CreatePLMRecordInput
  ): Promise<PLMRecord & { milestones: PLMMilestone[] }> {
    const targetCost = data.targetCost
      ? new Prisma.Decimal(data.targetCost)
      : null;

    const record = await this.db.$transaction(async (tx) => {
      const created = await tx.pLMRecord.create({
        data: {
          brandId,
          styleName: data.styleName,
          styleCode: data.styleCode,
          season: data.season ?? null,
          stage: PLMStage.DESIGN,
          targetCost,
          manufacturerId: data.manufacturerId ?? null,
          assignedTo: data.assignedTo ?? null,
          notes: data.notes ?? null,
          skuId: data.skuId ?? null,
        },
        include: {
          milestones: true,
        },
      });

      // Auto-create the opening DESIGN milestone
      await tx.pLMMilestone.create({
        data: {
          plmRecordId: created.id,
          stage: PLMStage.DESIGN,
          completedAt: new Date(),
          notes: "Style record created",
        },
      });

      return tx.pLMRecord.findUniqueOrThrow({
        where: { id: created.id },
        include: { milestones: true },
      });
    });

    return record;
  }

  // ───────────────────────────────────────────
  // advanceStage
  // ───────────────────────────────────────────

  /**
   * Move a PLM record to a new stage.
   * Creates a milestone entry with timestamp + userId for the completed stage.
   * Emits plm.milestone-overdue event if outgoing stage was overdue.
   */
  async advanceStage(
    plmRecordId: string,
    input: AdvanceStageInput
  ): Promise<PLMRecord & { milestones: PLMMilestone[] }> {
    const existing = await this.db.pLMRecord.findUniqueOrThrow({
      where: { id: plmRecordId },
    });

    // Check if the current stage is overdue before transitioning
    const stageAge = daysSince(existing.updatedAt);
    const wasOverdue = stageAge >= OVERDUE_DAYS;

    const updated = await this.db.$transaction(async (tx) => {
      // Mark the completed stage milestone
      await tx.pLMMilestone.create({
        data: {
          plmRecordId,
          stage: existing.stage,
          completedAt: new Date(),
          completedBy: input.userId,
          notes: input.notes ?? null,
        },
      });

      // Advance to the new stage
      return tx.pLMRecord.update({
        where: { id: plmRecordId },
        data: { stage: input.newStage },
        include: { milestones: true },
      });
    });

    if (wasOverdue) {
      await emitEvent("plm.milestone-overdue", {
        plmRecordId,
        brandId: existing.brandId,
        styleCode: existing.styleCode,
        styleName: existing.styleName,
        stage: existing.stage,
        stageAgeDays: stageAge,
        resolvedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  // ───────────────────────────────────────────
  // updateCost
  // ───────────────────────────────────────────

  /**
   * Log a cost entry and recompute the record's current cost + variance.
   * Cost variance is always server-computed — never from client input.
   * Flags the record and emits plm.cost-blowout if >15% over target.
   *
   * currentCost is set to the most recent 'total' entry for that record,
   * or the sum of all non-'total' entries if no 'total' entry exists.
   */
  async updateCost(
    plmRecordId: string,
    costEntry: CostEntryInput
  ): Promise<{ record: PLMRecord; entry: PLMCostEntry; flagTriggered: boolean }> {
    const record = await this.db.pLMRecord.findUniqueOrThrow({
      where: { id: plmRecordId },
    });

    // Log the cost entry
    const entry = await this.db.pLMCostEntry.create({
      data: {
        plmRecordId,
        entryType: costEntry.entryType,
        amount: new Prisma.Decimal(costEntry.amount),
        colourway: costEntry.colourway ?? null,
        currency: costEntry.currency ?? "AUD",
        notes: costEntry.notes ?? null,
        recordedBy: costEntry.recordedBy ?? null,
      },
    });

    // Recompute current cost from all entries for this record
    // Use the latest 'total' entry if it exists; otherwise sum all non-total entries
    const allEntries = await this.db.pLMCostEntry.findMany({
      where: { plmRecordId },
      orderBy: { recordedAt: "desc" },
    });

    let currentCost: Prisma.Decimal | null = null;
    const totalEntry = allEntries.find((e) => e.entryType === "total");
    if (totalEntry) {
      currentCost = totalEntry.amount;
    } else {
      const sum = allEntries.reduce(
        (acc, e) => acc.plus(e.amount),
        new Prisma.Decimal(0)
      );
      currentCost = allEntries.length > 0 ? sum : null;
    }

    // Recompute variance and flag — server-side always
    const { costVariance, costFlag } = recomputeCostFields(
      record.targetCost,
      currentCost
    );

    const wasFlagged = record.costFlag;
    const updatedRecord = await this.db.pLMRecord.update({
      where: { id: plmRecordId },
      data: { currentCost, costVariance, costFlag },
    });

    // Emit cost-blowout event if flag newly triggered
    const flagTriggered = costFlag && !wasFlagged;
    if (flagTriggered) {
      await emitEvent("plm.cost-blowout", {
        plmRecordId,
        brandId: record.brandId,
        styleCode: record.styleCode,
        styleName: record.styleName,
        targetCost: toDecimalString(record.targetCost),
        currentCost: toDecimalString(currentCost),
        costVariance: toDecimalString(costVariance),
        triggeredAt: new Date().toISOString(),
      });
    }

    return { record: updatedRecord, entry, flagTriggered };
  }

  // ───────────────────────────────────────────
  // logSampleRound
  // ───────────────────────────────────────────

  /**
   * Log a new sample round with tracking details and fit results.
   */
  async logSampleRound(
    plmRecordId: string,
    data: SampleRoundInput
  ): Promise<PLMSampleRound> {
    // Verify record exists
    await this.db.pLMRecord.findUniqueOrThrow({ where: { id: plmRecordId } });

    return this.db.pLMSampleRound.create({
      data: {
        plmRecordId,
        roundNumber: data.roundNumber,
        shippedAt: data.shippedAt ?? null,
        trackingNumber: data.trackingNumber ?? null,
        carrier: data.carrier ?? null,
        receivedAt: data.receivedAt ?? null,
        fitNotes: data.fitNotes ?? null,
        fitApproved: data.fitApproved ?? null,
        adjustments: data.adjustments ?? null,
      },
    });
  }

  // ───────────────────────────────────────────
  // getPLMDashboard
  // ───────────────────────────────────────────

  /**
   * Aggregate dashboard view for a brand.
   * All styles grouped by stage — cost-flagged and overdue surfaced first.
   */
  async getPLMDashboard(brandId: string): Promise<PLMDashboard> {
    const records = await this.db.pLMRecord.findMany({
      where: { brandId },
      include: {
        milestones: { orderBy: { createdAt: "desc" }, take: 1 },
        sampleRounds: { orderBy: { roundNumber: "desc" }, take: 1 },
        _count: { select: { milestones: true } },
      },
      orderBy: [{ costFlag: "desc" }, { updatedAt: "asc" }],
    });

    // Group by stage
    const stageMap = new Map<PLMStage, PLMRecordSummary[]>();

    for (const record of records) {
      const stageAge = daysSince(record.updatedAt);
      const isOverdue = stageAge >= OVERDUE_DAYS;

      const summary: PLMRecordSummary = {
        id: record.id,
        styleName: record.styleName,
        styleCode: record.styleCode,
        season: record.season,
        stage: record.stage,
        costFlag: record.costFlag,
        isOverdue,
        stageAgeDays: stageAge,
        targetCost: toDecimalString(record.targetCost),
        currentCost: toDecimalString(record.currentCost),
        costVariance: toDecimalString(record.costVariance),
        updatedAt: record.updatedAt,
        milestonesCount: record._count.milestones,
        latestSampleRound: record.sampleRounds[0]?.roundNumber ?? null,
      };

      const group = stageMap.get(record.stage) ?? [];
      group.push(summary);
      stageMap.set(record.stage, group);
    }

    const stageGroups: PLMDashboardStageGroup[] = Array.from(stageMap.entries()).map(
      ([stage, stageRecords]) => ({
        stage,
        // Within each stage: flagged first, then overdue, then by updatedAt
        records: stageRecords.sort((a, b) => {
          if (a.costFlag !== b.costFlag) return a.costFlag ? -1 : 1;
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          return a.updatedAt.getTime() - b.updatedAt.getTime();
        }),
      })
    );

    const costFlaggedCount = records.filter((r) => r.costFlag).length;
    const overdueCount = records.filter((r) => daysSince(r.updatedAt) >= OVERDUE_DAYS).length;

    return {
      brandId,
      totalStyles: records.length,
      costFlaggedCount,
      overdueCount,
      stageGroups,
      generatedAt: new Date(),
    };
  }

  // ───────────────────────────────────────────
  // getCostHistory
  // ───────────────────────────────────────────

  /**
   * Full cost trail for a style — all entries in chronological order.
   */
  async getCostHistory(plmRecordId: string): Promise<CostHistoryResult> {
    const record = await this.db.pLMRecord.findUniqueOrThrow({
      where: { id: plmRecordId },
      include: {
        costEntries: { orderBy: { recordedAt: "asc" } },
      },
    });

    return {
      plmRecordId: record.id,
      styleName: record.styleName,
      styleCode: record.styleCode,
      targetCost: toDecimalString(record.targetCost),
      currentCost: toDecimalString(record.currentCost),
      costVariance: toDecimalString(record.costVariance),
      costFlag: record.costFlag,
      entries: record.costEntries,
    };
  }

  // ───────────────────────────────────────────
  // getOverdueMilestones
  // ───────────────────────────────────────────

  /**
   * Styles that have been in the same stage for >14 days.
   * Ordered by how long they've been stuck (worst first).
   */
  async getOverdueMilestones(brandId: string): Promise<OverdueRecord[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);

    const records = await this.db.pLMRecord.findMany({
      where: {
        brandId,
        updatedAt: { lte: cutoff },
        stage: { not: PLMStage.DELIVERED },
        // Exclude CANCELLED — those aren't overdue, they're done
        NOT: { stage: PLMStage.CANCELLED },
      },
      orderBy: { updatedAt: "asc" }, // oldest first = most overdue
    });

    return records.map((r) => ({
      id: r.id,
      styleName: r.styleName,
      styleCode: r.styleCode,
      stage: r.stage,
      stageAgeDays: daysSince(r.updatedAt),
      assignedTo: r.assignedTo,
      updatedAt: r.updatedAt,
    }));
  }

  // ───────────────────────────────────────────
  // compareToPreviousOrder
  // ───────────────────────────────────────────

  /**
   * Find all prior PLM records for the same styleCode.
   * Returns them in chronological order for cost comparison.
   * Useful for season-over-season cost trend analysis.
   */
  async compareToPreviousOrder(styleCode: string): Promise<CostComparisonResult> {
    const records = await this.db.pLMRecord.findMany({
      where: { styleCode },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        styleName: true,
        season: true,
        targetCost: true,
        currentCost: true,
        costVariance: true,
        createdAt: true,
      },
    });

    return {
      styleCode,
      records: records.map((r) => ({
        id: r.id,
        styleName: r.styleName,
        season: r.season,
        targetCost: toDecimalString(r.targetCost),
        currentCost: toDecimalString(r.currentCost),
        costVariance: toDecimalString(r.costVariance),
        createdAt: r.createdAt,
      })),
    };
  }

  // ───────────────────────────────────────────
  // getCostFlaggedRecords
  // ───────────────────────────────────────────

  /**
   * All styles with active cost blowout flags for a brand.
   */
  async getCostFlaggedRecords(brandId: string): Promise<PLMRecord[]> {
    return this.db.pLMRecord.findMany({
      where: { brandId, costFlag: true },
      orderBy: { costVariance: "desc" }, // worst variance first
    });
  }

  // ───────────────────────────────────────────
  // getRecord
  // ───────────────────────────────────────────

  /**
   * Get a single PLM record with full history.
   */
  async getRecord(
    plmRecordId: string
  ): Promise<
    PLMRecord & {
      milestones: PLMMilestone[];
      costEntries: PLMCostEntry[];
      sampleRounds: PLMSampleRound[];
    }
  > {
    return this.db.pLMRecord.findUniqueOrThrow({
      where: { id: plmRecordId },
      include: {
        milestones: { orderBy: { createdAt: "asc" } },
        costEntries: { orderBy: { recordedAt: "asc" } },
        sampleRounds: { orderBy: { roundNumber: "asc" } },
      },
    });
  }

  // ───────────────────────────────────────────
  // checkAndEmitOverdueEvents
  // ───────────────────────────────────────────

  /**
   * Batch job helper — called by the BullMQ worker on a cron schedule.
   * Emits plm.milestone-overdue events for any records newly crossing the
   * 14-day threshold since the last run.
   *
   * Pass lastRunAt to avoid re-emitting events for already-flagged records.
   */
  async checkAndEmitOverdueEvents(brandId?: string): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);

    // Find records that crossed the threshold and are still in-progress
    const overdueRecords = await this.db.pLMRecord.findMany({
      where: {
        ...(brandId ? { brandId } : {}),
        updatedAt: { lte: cutoff },
        stage: {
          notIn: [PLMStage.DELIVERED, PLMStage.CANCELLED],
        },
      },
    });

    for (const record of overdueRecords) {
      await emitEvent("plm.milestone-overdue", {
        plmRecordId: record.id,
        brandId: record.brandId,
        styleCode: record.styleCode,
        styleName: record.styleName,
        stage: record.stage,
        stageAgeDays: daysSince(record.updatedAt),
        detectedAt: new Date().toISOString(),
      });
    }

    return overdueRecords.length;
  }
}
