/**
 * PLM Dashboard — Brand view
 *
 * Kanban-style layout: styles grouped by stage.
 * Cost-flagged styles highlighted in amber.
 * Overdue styles (>14 days in same stage) highlighted in red.
 * Click through to individual style record.
 *
 * Data fetched server-side via the PLM API.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

// ─────────────────────────────────────────────
// Types (mirroring service output shapes)
// ─────────────────────────────────────────────

type PLMStage =
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

interface PLMRecordSummary {
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
  updatedAt: string;
  milestonesCount: number;
  latestSampleRound: number | null;
}

interface PLMDashboardStageGroup {
  stage: PLMStage;
  records: PLMRecordSummary[];
}

interface PLMDashboard {
  brandId: string;
  totalStyles: number;
  costFlaggedCount: number;
  overdueCount: number;
  stageGroups: PLMDashboardStageGroup[];
  generatedAt: string;
}

// ─────────────────────────────────────────────
// Stage display config
// ─────────────────────────────────────────────

const STAGE_LABELS: Record<PLMStage, string> = {
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

// Colour coding per stage group
const STAGE_HEADER_COLOUR: Record<PLMStage, string> = {
  DESIGN: "bg-slate-100 text-slate-700",
  TECH_PACK_SENT: "bg-blue-50 text-blue-700",
  TECH_PACK_APPROVED: "bg-blue-100 text-blue-800",
  SAMPLE_ORDERED: "bg-violet-50 text-violet-700",
  SAMPLE_IN_PRODUCTION: "bg-violet-100 text-violet-800",
  SAMPLE_SHIPPED: "bg-indigo-100 text-indigo-800",
  SAMPLE_RECEIVED: "bg-indigo-200 text-indigo-900",
  FIT_SESSION: "bg-pink-50 text-pink-700",
  ADJUSTMENTS_SENT: "bg-pink-100 text-pink-800",
  COUNTER_SAMPLE_REQUESTED: "bg-orange-50 text-orange-700",
  COUNTER_SAMPLE_SHIPPED: "bg-orange-100 text-orange-700",
  COUNTER_SAMPLE_RECEIVED: "bg-orange-200 text-orange-800",
  BULK_APPROVED: "bg-green-100 text-green-800",
  IN_PRODUCTION: "bg-green-200 text-green-900",
  SHIPPED: "bg-teal-100 text-teal-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

// ─────────────────────────────────────────────
// Data fetching (server component)
// ─────────────────────────────────────────────

async function fetchPLMDashboard(brandId: string): Promise<PLMDashboard | null> {
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBase}/api/v1/plm/brands/${brandId}/dashboard`, {
    // Revalidate every 60 seconds — near-real-time without hammering the API
    next: { revalidate: 60 },
    headers: {
      // In production this would carry the internal service-to-service auth token
      "x-internal-token": process.env.INTERNAL_API_TOKEN ?? "",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`PLM dashboard fetch failed: ${res.status}`);
  }

  const json = await res.json();
  return json.data as PLMDashboard;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SummaryBar({
  totalStyles,
  costFlaggedCount,
  overdueCount,
}: {
  totalStyles: number;
  costFlaggedCount: number;
  overdueCount: number;
}) {
  return (
    <div className="flex gap-4 mb-6">
      <StatCard label="Total Styles" value={totalStyles} colour="text-slate-700" />
      <StatCard
        label="Cost Flagged"
        value={costFlaggedCount}
        colour={costFlaggedCount > 0 ? "text-amber-600" : "text-slate-400"}
        bg={costFlaggedCount > 0 ? "bg-amber-50 border-amber-200" : undefined}
      />
      <StatCard
        label="Overdue"
        value={overdueCount}
        colour={overdueCount > 0 ? "text-red-600" : "text-slate-400"}
        bg={overdueCount > 0 ? "bg-red-50 border-red-200" : undefined}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  colour,
  bg,
}: {
  label: string;
  value: number;
  colour: string;
  bg?: string;
}) {
  return (
    <div
      className={`rounded-lg border px-5 py-3 flex flex-col min-w-[120px] ${bg ?? "bg-white border-slate-200"}`}
    >
      <span className={`text-2xl font-bold ${colour}`}>{value}</span>
      <span className="text-xs text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

function StyleCard({ record }: { record: PLMRecordSummary }) {
  const isFlagged = record.costFlag;
  const isOverdue = record.isOverdue;

  let cardClass =
    "rounded-lg border p-3 mb-2 cursor-pointer transition-shadow hover:shadow-md bg-white border-slate-200";
  if (isFlagged && isOverdue) {
    cardClass =
      "rounded-lg border p-3 mb-2 cursor-pointer transition-shadow hover:shadow-md bg-amber-50 border-amber-400";
  } else if (isFlagged) {
    cardClass =
      "rounded-lg border p-3 mb-2 cursor-pointer transition-shadow hover:shadow-md bg-amber-50 border-amber-300";
  } else if (isOverdue) {
    cardClass =
      "rounded-lg border p-3 mb-2 cursor-pointer transition-shadow hover:shadow-md bg-red-50 border-red-300";
  }

  return (
    <Link href={`/plm/${record.id}`} className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {record.styleName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {record.styleCode}
            {record.season ? ` · ${record.season}` : ""}
          </p>
        </div>
        <div className="flex gap-1 shrink-0 mt-0.5">
          {isFlagged && (
            <span
              className="text-[10px] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded"
              title="Cost blowout — over 15% of target"
            >
              COST
            </span>
          )}
          {isOverdue && (
            <span
              className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded"
              title={`In this stage for ${record.stageAgeDays} days`}
            >
              LATE
            </span>
          )}
        </div>
      </div>

      {/* Cost row */}
      {(record.targetCost || record.currentCost) && (
        <div className="mt-2 flex gap-3 text-xs text-slate-600">
          {record.targetCost && (
            <span>
              <span className="text-slate-400">Target</span>{" "}
              <span className="font-medium">${record.targetCost}</span>
            </span>
          )}
          {record.currentCost && (
            <span>
              <span className="text-slate-400">Current</span>{" "}
              <span
                className={`font-medium ${isFlagged ? "text-amber-700" : ""}`}
              >
                ${record.currentCost}
              </span>
            </span>
          )}
          {record.costVariance && parseFloat(record.costVariance) !== 0 && (
            <span
              className={
                parseFloat(record.costVariance) > 0
                  ? "text-amber-600 font-medium"
                  : "text-green-600 font-medium"
              }
            >
              {parseFloat(record.costVariance) > 0 ? "+" : ""}
              {record.costVariance}
            </span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
        {record.latestSampleRound !== null && (
          <span>S{record.latestSampleRound}</span>
        )}
        {record.stageAgeDays > 0 && (
          <span>{record.stageAgeDays}d in stage</span>
        )}
      </div>
    </Link>
  );
}

function StageColumn({ group }: { group: PLMDashboardStageGroup }) {
  const headerClass = STAGE_HEADER_COLOUR[group.stage] ?? "bg-slate-100 text-slate-700";
  const count = group.records.length;

  return (
    <div className="min-w-[220px] max-w-[260px] shrink-0">
      <div
        className={`rounded-md px-3 py-1.5 mb-3 flex items-center justify-between ${headerClass}`}
      >
        <span className="text-xs font-semibold">
          {STAGE_LABELS[group.stage] ?? group.stage}
        </span>
        <span className="text-xs opacity-70 ml-2">{count}</span>
      </div>
      <div>
        {group.records.map((record) => (
          <StyleCard key={record.id} record={record} />
        ))}
        {count === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-4">
            No styles
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page component (async server component)
// ─────────────────────────────────────────────

interface PLMPageProps {
  searchParams: { brandId?: string };
}

export default async function PLMPage({ searchParams }: PLMPageProps) {
  const brandId = searchParams.brandId;

  if (!brandId) {
    // In production this would come from the auth session context
    return (
      <div className="p-8 text-slate-500 text-sm">
        No brand selected. PLM dashboard requires a brand context.
      </div>
    );
  }

  let dashboard: PLMDashboard | null;
  try {
    dashboard = await fetchPLMDashboard(brandId);
  } catch {
    return (
      <div className="p-8 text-red-600 text-sm">
        Failed to load PLM dashboard. Please try again.
      </div>
    );
  }

  if (!dashboard) {
    notFound();
  }

  // Only show non-empty + non-cancelled stage groups, unless everything is cancelled
  const visibleGroups = dashboard.stageGroups.filter(
    (g) => g.records.length > 0 && g.stage !== "CANCELLED"
  );
  const cancelledGroup = dashboard.stageGroups.find(
    (g) => g.stage === "CANCELLED" && g.records.length > 0
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Production Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {dashboard.totalStyles} style
            {dashboard.totalStyles !== 1 ? "s" : ""} in pipeline
          </p>
        </div>
        <Link
          href={`/plm/new?brandId=${brandId}`}
          className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-700 transition-colors"
        >
          + New Style
        </Link>
      </div>

      {/* Summary stats */}
      <SummaryBar
        totalStyles={dashboard.totalStyles}
        costFlaggedCount={dashboard.costFlaggedCount}
        overdueCount={dashboard.overdueCount}
      />

      {/* Kanban board */}
      {visibleGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No styles in pipeline yet.</p>
          <p className="text-sm mt-1">
            Create your first style record to start tracking production.
          </p>
          <Link
            href={`/plm/new?brandId=${brandId}`}
            className="mt-4 inline-block px-5 py-2 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-700"
          >
            Add first style
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {visibleGroups.map((group) => (
              <StageColumn key={group.stage} group={group} />
            ))}
          </div>
        </div>
      )}

      {/* Cancelled styles — collapsed section */}
      {cancelledGroup && cancelledGroup.records.length > 0 && (
        <details className="mt-6">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
            {cancelledGroup.records.length} cancelled style
            {cancelledGroup.records.length !== 1 ? "s" : ""} (hidden)
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            {cancelledGroup.records.map((record) => (
              <Link
                key={record.id}
                href={`/plm/${record.id}`}
                className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-1"
              >
                {record.styleName} ({record.styleCode})
              </Link>
            ))}
          </div>
        </details>
      )}

      {/* Footer */}
      <p className="mt-8 text-[11px] text-slate-300">
        Dashboard refreshes every 60s ·{" "}
        {new Date(dashboard.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
