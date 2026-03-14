/**
 * Production Lifecycle Management (PLM) types.
 * Tracks every garment/SKU from first sketch to bulk production approval.
 *
 * These types mirror the Prisma schema and PLMService output shapes.
 * Use Decimal strings (not numbers) for all currency fields to preserve precision.
 */

// ─────────────────────────────────────────────
// Stage enum
// ─────────────────────────────────────────────

export type PLMStage =
  | "DESIGN"
  | "TECH_PACK_SENT"
  | "TECH_PACK_APPROVED"
  | "SAMPLE_ORDERED"
  | "SAMPLE_IN_PRODUCTION"
  | "SAMPLE_SHIPPED"
  | "SAMPLE_RECEIVED"
  | "FIT_SESSION"
  | "ADJUSTMENTS_SENT"
  | "COUNTER_SAMPLE_REQUESTED"
  | "COUNTER_SAMPLE_SHIPPED"
  | "COUNTER_SAMPLE_RECEIVED"
  | "BULK_APPROVED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

// Human-readable stage labels for UI use
export const PLM_STAGE_LABELS: Record<PLMStage, string> = {
  DESIGN: "Design",
  TECH_PACK_SENT: "Tech Pack Sent",
  TECH_PACK_APPROVED: "Tech Pack Approved",
  SAMPLE_ORDERED: "Sample Ordered",
  SAMPLE_IN_PRODUCTION: "Sample in Production",
  SAMPLE_SHIPPED: "Sample Shipped",
  SAMPLE_RECEIVED: "Sample Received",
  FIT_SESSION: "Fit Session",
  ADJUSTMENTS_SENT: "Adjustments Sent",
  COUNTER_SAMPLE_REQUESTED: "Counter Sample Requested",
  COUNTER_SAMPLE_SHIPPED: "Counter Sample Shipped",
  COUNTER_SAMPLE_RECEIVED: "Counter Sample Received",
  BULK_APPROVED: "Bulk Approved",
  IN_PRODUCTION: "In Production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

// Ordered sequence of active stages (excludes CANCELLED)
export const PLM_STAGE_SEQUENCE: PLMStage[] = [
  "DESIGN",
  "TECH_PACK_SENT",
  "TECH_PACK_APPROVED",
  "SAMPLE_ORDERED",
  "SAMPLE_IN_PRODUCTION",
  "SAMPLE_SHIPPED",
  "SAMPLE_RECEIVED",
  "FIT_SESSION",
  "ADJUSTMENTS_SENT",
  "COUNTER_SAMPLE_REQUESTED",
  "COUNTER_SAMPLE_SHIPPED",
  "COUNTER_SAMPLE_RECEIVED",
  "BULK_APPROVED",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
];

// ─────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────

export interface PLMRecord {
  id: string;
  brandId: string;
  skuId: string | null;
  styleName: string;
  styleCode: string;
  season: string | null;
  stage: PLMStage;
  /** Decimal string — e.g. "45.00" (AUD) */
  targetCost: string | null;
  /** Decimal string — recomputed server-side from cost entries */
  currentCost: string | null;
  /** Decimal string — currentCost minus targetCost */
  costVariance: string | null;
  /** True when currentCost is >15% over targetCost */
  costFlag: boolean;
  manufacturerId: string | null;
  assignedTo: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PLMMilestone {
  id: string;
  plmRecordId: string;
  stage: PLMStage;
  completedAt: Date | null;
  completedBy: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface PLMCostEntry {
  id: string;
  plmRecordId: string;
  /** 'fabric' | 'trim' | 'labour' | 'shipping' | 'duty' | 'total' */
  entryType: string;
  colourway: string | null;
  /** Decimal string */
  amount: string;
  currency: string;
  notes: string | null;
  recordedAt: Date;
  recordedBy: string | null;
}

export interface PLMSampleRound {
  id: string;
  plmRecordId: string;
  roundNumber: number;
  shippedAt: Date | null;
  trackingNumber: string | null;
  carrier: string | null;
  receivedAt: Date | null;
  fitNotes: string | null;
  fitApproved: boolean | null;
  adjustments: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Input types
// ─────────────────────────────────────────────

export interface CreatePLMRecordInput {
  brandId: string;
  styleName: string;
  styleCode: string;
  season?: string;
  /** Decimal string — e.g. "45.00" */
  targetCost?: string;
  manufacturerId?: string;
  assignedTo?: string;
  notes?: string;
  skuId?: string;
}

export interface AdvanceStageInput {
  newStage: PLMStage;
  notes?: string;
}

export interface LogCostEntryInput {
  entryType: "fabric" | "trim" | "labour" | "shipping" | "duty" | "total" | string;
  /** Decimal string — always use string to avoid float rounding */
  amount: string;
  colourway?: string;
  currency?: string;
  notes?: string;
}

export interface LogSampleRoundInput {
  roundNumber: number;
  shippedAt?: string; // ISO 8601
  trackingNumber?: string;
  carrier?: string;
  receivedAt?: string; // ISO 8601
  fitNotes?: string;
  fitApproved?: boolean;
  adjustments?: string;
}

// ─────────────────────────────────────────────
// Dashboard / query result types
// ─────────────────────────────────────────────

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

export interface PLMDashboardStageGroup {
  stage: PLMStage;
  records: PLMRecordSummary[];
}

export interface PLMDashboard {
  brandId: string;
  totalStyles: number;
  costFlaggedCount: number;
  overdueCount: number;
  stageGroups: PLMDashboardStageGroup[];
  generatedAt: Date;
}

export interface PLMCostHistory {
  plmRecordId: string;
  styleName: string;
  styleCode: string;
  targetCost: string | null;
  currentCost: string | null;
  costVariance: string | null;
  costFlag: boolean;
  entries: PLMCostEntry[];
}

export interface PLMOverdueRecord {
  id: string;
  styleName: string;
  styleCode: string;
  stage: PLMStage;
  stageAgeDays: number;
  assignedTo: string | null;
  updatedAt: Date;
}

export interface PLMCostComparison {
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
// EventBridge event payloads
// ─────────────────────────────────────────────

export interface PLMCostBlowoutEvent {
  plmRecordId: string;
  brandId: string;
  styleCode: string;
  styleName: string;
  targetCost: string | null;
  currentCost: string | null;
  costVariance: string | null;
  triggeredAt: string; // ISO 8601
}

export interface PLMMilestoneOverdueEvent {
  plmRecordId: string;
  brandId: string;
  styleCode: string;
  styleName: string;
  stage: PLMStage;
  stageAgeDays: number;
  detectedAt: string; // ISO 8601
}
