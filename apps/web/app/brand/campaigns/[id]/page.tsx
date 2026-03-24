/**
 * Campaign Detail Page — /campaigns/:id
 *
 * The command centre for a single campaign. Everything a brand needs
 * to understand how their campaign is performing and take action.
 *
 * Sections:
 *   1. Header — title, status badge, quick action buttons
 *   2. Progress overview — real-time backing count, MOQ progress, revenue
 *   3. Size distribution — bar chart of which sizes are being backed
 *   4. Timeline — campaign dates, time remaining
 *   5. Backer list — paginated, sortable list of backings
 *   6. Campaign actions — publish, cancel, mark shipped, etc.
 *
 * Real-time updates via Supabase Realtime subscription on the campaigns row.
 * Size breaks polled every 30s (lighter-weight than realtime).
 *
 * Architecture: "use client" because of real-time subscription + action buttons.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../../../lib/supabase";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "moq_reached"
  | "funded"
  | "in_production"
  | "shipped"
  | "completed"
  | "cancelled"
  | "expired";

interface SizeBreak {
  size: string;
  backingCount: number;
}

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: CampaignStatus;
  coverImageUrl: string | null;
  retailPriceCents: number;
  backerPriceCents: number;
  depositPercent: number;
  currency: string;
  moq: number;
  currentBackingCount: number;
  moqReached: boolean;
  moqReachedAt: string | null;
  stretchGoalQty: number | null;
  campaignStart: string;
  campaignEnd: string;
  estimatedShipDate: string | null;
  manufacturerId: string | null;
  manufacturerNotifiedAt: string | null;
  availableSizes: string[];
  createdAt: string;
  sizeBreaks: SizeBreak[];
}

interface BackingSummary {
  id: string;
  size: string;
  quantity: number;
  totalCents: number;
  depositCents: number;
  currency: string;
  depositStatus: string;
  status: string;
  createdAt: string;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    city?: string;
    country?: string;
  };
}

interface BackingListResponse {
  data: BackingSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<CampaignStatus, { label: string; badge: string; dot: string }> = {
  draft:         { label: "Draft",         badge: "bg-[var(--surface-2)] text-[var(--text-tertiary)]",    dot: "bg-[var(--text-tertiary)]" },
  scheduled:     { label: "Scheduled",     badge: "bg-blue-50 text-blue-600",                              dot: "bg-blue-500" },
  active:        { label: "Live",          badge: "bg-[#22C55E]/10 text-[#22C55E]",                        dot: "bg-[#22C55E] animate-pulse" },
  moq_reached:   { label: "Goal Reached",  badge: "bg-indigo-50 text-indigo-600",                          dot: "bg-indigo-500" },
  funded:        { label: "Funded",        badge: "bg-indigo-50 text-indigo-700",                          dot: "bg-indigo-600" },
  in_production: { label: "In Production", badge: "bg-purple-50 text-purple-700",                          dot: "bg-purple-600" },
  shipped:       { label: "Shipped",       badge: "bg-sky-50 text-sky-700",                                dot: "bg-sky-500" },
  completed:     { label: "Completed",     badge: "bg-emerald-50 text-emerald-700",                        dot: "bg-emerald-500" },
  cancelled:     { label: "Cancelled",     badge: "bg-red-50 text-red-600",                                dot: "bg-red-400" },
  expired:       { label: "Expired",       badge: "bg-orange-50 text-orange-600",                          dot: "bg-orange-400" },
};

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.badge}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────

function ProgressSection({
  count,
  moq,
  stretchGoalQty,
  moqReached,
  revenue,
  currency,
}: {
  count: number;
  moq: number;
  stretchGoalQty: number | null;
  moqReached: boolean;
  revenue: number;
  currency: string;
}) {
  const pct = Math.min(100, Math.round((count / moq) * 100));
  const needed = Math.max(0, moq - count);

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
      <h2 className="font-semibold text-[var(--text-primary)] mb-5">Campaign progress</h2>

      {/* Big number */}
      <div className="flex items-end gap-2 mb-4">
        <span className="font-display text-5xl text-[var(--text-primary)] leading-none tabular-nums">
          {count.toLocaleString()}
        </span>
        <span className="text-[var(--text-secondary)] pb-1">
          / {moq.toLocaleString()} backers
        </span>
        {moqReached && (
          <span className="pb-1 text-[#22C55E] font-medium text-sm">
            🎉 Goal reached!
          </span>
        )}
      </div>

      {/* Progress track */}
      <div
        className="relative h-4 bg-[var(--surface-2)] rounded-full overflow-hidden mb-3"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of goal`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? "#22C55E" : "#6366f1",
          }}
        />
        {/* MOQ marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--loocbooc-black)] opacity-30"
          style={{ left: "100%" }}
        />
        {/* Stretch goal marker */}
        {stretchGoalQty && stretchGoalQty > moq && (
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-400"
            style={{ left: `${Math.min(100, (moq / stretchGoalQty) * 100)}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-sm mb-6">
        <span className="text-[var(--text-secondary)]">
          {moqReached
            ? "MOQ reached ✅"
            : `${needed.toLocaleString()} more backers to reach goal`}
        </span>
        <span className={`font-semibold ${pct >= 100 ? "text-[#22C55E]" : "text-[var(--text-primary)]"}`}>
          {pct}%
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-px bg-[var(--surface-3)] rounded-[var(--radius-lg)] overflow-hidden">
        {[
          { label: "Total backers",     value: count.toLocaleString() },
          { label: "Revenue",           value: `${currency} ${(revenue / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}` },
          { label: "Avg. backing",      value: count > 0 ? `${currency} ${(revenue / 100 / count).toFixed(0)}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[var(--surface-1)] px-4 py-3 text-center">
            <p className="text-xs text-[var(--text-tertiary)] mb-0.5">{label}</p>
            <p className="font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Size distribution
// ─────────────────────────────────────────────

function SizeDistribution({
  sizeBreaks,
  totalBackers,
}: {
  sizeBreaks: SizeBreak[];
  totalBackers: number;
}) {
  const maxCount = Math.max(...sizeBreaks.map((s) => s.backingCount), 1);

  if (sizeBreaks.length === 0) {
    return (
      <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
        <h2 className="font-semibold text-[var(--text-primary)] mb-4">Size distribution</h2>
        <p className="text-sm text-[var(--text-tertiary)]">No backings yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-[var(--text-primary)]">Size distribution</h2>
        <span className="text-xs text-[var(--text-tertiary)]">{totalBackers} total</span>
      </div>
      <div className="space-y-3">
        {sizeBreaks
          .sort((a, b) => b.backingCount - a.backingCount)
          .map(({ size, backingCount }) => {
            const pct = totalBackers > 0 ? Math.round((backingCount / totalBackers) * 100) : 0;
            const barWidth = Math.round((backingCount / maxCount) * 100);
            return (
              <div key={size} className="flex items-center gap-3">
                <span className="text-sm font-mono font-medium text-[var(--text-primary)] w-8 shrink-0 text-right">
                  {size}
                </span>
                <div className="flex-1 h-7 bg-[var(--surface-2)] rounded-[var(--radius-md)] overflow-hidden relative">
                  <div
                    className="h-full bg-indigo-500/20 rounded-[var(--radius-md)] transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2.5">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {backingCount} {backingCount === 1 ? "backer" : "backers"}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-tertiary)] w-8 shrink-0 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Timeline card
// ─────────────────────────────────────────────

function TimelineCard({ campaign }: { campaign: Campaign }) {
  const now = Date.now();
  const startTime = new Date(campaign.campaignStart).getTime();
  const endTime = new Date(campaign.campaignEnd).getTime();
  const totalDuration = endTime - startTime;
  const elapsed = Math.max(0, now - startTime);
  const pct = totalDuration > 0 ? Math.min(100, Math.round((elapsed / totalDuration) * 100)) : 0;
  const daysLeft = Math.max(0, Math.ceil((endTime - now) / 86400000));
  const isActive = campaign.status === "active";

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
      <h2 className="font-semibold text-[var(--text-primary)] mb-5">Timeline</h2>

      {/* Date range */}
      <div className="flex justify-between text-sm text-[var(--text-secondary)] mb-2">
        <span>{new Date(campaign.campaignStart).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
        <span>{new Date(campaign.campaignEnd).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
      </div>

      {/* Progress track */}
      <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-[var(--loocbooc-black)] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {isActive && (
        <p className="text-sm font-medium text-[var(--text-primary)] text-center mb-5">
          {daysLeft === 0 ? "Ends today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days remaining`}
        </p>
      )}

      {/* Key dates */}
      <div className="space-y-2.5 mt-4 pt-4 border-t border-[var(--surface-3)]">
        {[
          { icon: "📣", label: "Opens",     date: campaign.campaignStart, done: startTime < now },
          { icon: "🏁", label: "Closes",    date: campaign.campaignEnd,   done: endTime < now },
          ...(campaign.estimatedShipDate ? [{
            icon: "📦",
            label: "Est. ship",
            date: campaign.estimatedShipDate,
            done: new Date(campaign.estimatedShipDate).getTime() < now,
          }] : []),
          ...(campaign.moqReachedAt ? [{
            icon: "🎉",
            label: "Goal reached",
            date: campaign.moqReachedAt,
            done: true,
          }] : []),
        ].map(({ icon, label, date, done }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-base w-6 text-center">{icon}</span>
            <div className="flex-1">
              <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
              <p className={`text-sm font-medium ${done ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                {new Date(date).toLocaleDateString("en-AU", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {done && <span className="text-[var(--text-tertiary)] text-xs">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

type ActionState = "idle" | "loading" | "success" | "error";

function CampaignActions({
  campaign,
  onStatusChange,
}: {
  campaign: Campaign;
  onStatusChange: () => void;
}) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const doAction = async (url: string, method = "POST") => {
    setActionState("loading");
    setActionError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Action failed");
      }
      setActionState("success");
      onStatusChange();
    } catch (err) {
      setActionState("error");
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const { status } = campaign;
  const isLoading = actionState === "loading";

  const btnBase = `w-full py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`;
  const btnPrimary = `${btnBase} bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] hover:opacity-90`;
  const btnSecondary = `${btnBase} border border-[var(--surface-3)] text-[var(--text-primary)] hover:bg-[var(--surface-2)]`;
  const btnDanger = `${btnBase} bg-red-500 text-white hover:opacity-90`;

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
      <h2 className="font-semibold text-[var(--text-primary)] mb-5">Actions</h2>

      <div className="space-y-3">
        {/* Draft → publish */}
        {status === "draft" && (
          <button
            onClick={() => void doAction(`/api/v1/back-it/campaigns/${campaign.id}/publish`)}
            disabled={isLoading}
            className={btnPrimary}
          >
            {isLoading ? "Publishing…" : "Publish campaign"}
          </button>
        )}

        {/* View public page */}
        {["active", "moq_reached", "funded", "in_production", "shipped"].includes(status) && (
          <Link
            href={`/back/${campaign.id}`}
            target="_blank"
            className={btnSecondary + " block text-center"}
          >
            View public page ↗
          </Link>
        )}

        {/* Mark in production */}
        {status === "funded" && (
          <button
            onClick={() => void doAction(`/api/v1/back-it/campaigns/${campaign.id}/mark-in-production`)}
            disabled={isLoading}
            className={btnPrimary}
          >
            {isLoading ? "Updating…" : "Mark as In Production"}
          </button>
        )}

        {/* Mark shipped */}
        {status === "in_production" && (
          <button
            onClick={() => void doAction(`/api/v1/back-it/campaigns/${campaign.id}/mark-shipped`)}
            disabled={isLoading}
            className={btnPrimary}
          >
            {isLoading ? "Updating…" : "Mark as Shipped"}
          </button>
        )}

        {/* Mark completed */}
        {status === "shipped" && (
          <button
            onClick={() => void doAction(`/api/v1/back-it/campaigns/${campaign.id}/mark-completed`)}
            disabled={isLoading}
            className={btnPrimary}
          >
            {isLoading ? "Updating…" : "Mark as Completed"}
          </button>
        )}

        {/* Edit (draft/scheduled only) */}
        {["draft", "scheduled"].includes(status) && (
          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className={btnSecondary + " block text-center"}
          >
            Edit campaign
          </Link>
        )}

        {/* Cancel */}
        {["draft", "scheduled", "active"].includes(status) && (
          <>
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className={btnSecondary}
              >
                Cancel campaign
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-100 rounded-[var(--radius-lg)] space-y-3">
                <p className="text-sm text-red-700 font-medium">Confirm cancellation</p>
                <p className="text-xs text-red-600">
                  This will cancel the campaign and refund all backers. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void doAction(`/api/v1/back-it/campaigns/${campaign.id}/cancel`)}
                    disabled={isLoading}
                    className={btnDanger + " flex-1"}
                  >
                    {isLoading ? "Cancelling…" : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className={btnSecondary + " flex-1"}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {actionError && (
        <p className="text-xs text-red-500 mt-3">{actionError}</p>
      )}
      {actionState === "success" && (
        <p className="text-xs text-[#22C55E] mt-3">✓ Updated successfully</p>
      )}

      {/* Manufacturer */}
      {campaign.manufacturerId && (
        <div className="mt-5 pt-5 border-t border-[var(--surface-3)]">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Manufacturer</p>
          <Link
            href={`/manufacturers/${campaign.manufacturerId}`}
            className="text-sm text-[var(--text-primary)] hover:underline"
          >
            View manufacturer profile →
          </Link>
          {campaign.manufacturerNotifiedAt && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Notified {new Date(campaign.manufacturerNotifiedAt).toLocaleDateString("en-AU")}
            </p>
          )}
        </div>
      )}
      {!campaign.manufacturerId && ["moq_reached", "funded"].includes(campaign.status) && (
        <div className="mt-5 pt-5 border-t border-[var(--surface-3)]">
          <p className="text-xs text-amber-700 font-medium mb-1">⚠ No manufacturer assigned</p>
          <p className="text-xs text-amber-600 mb-2">
            Your campaign has reached its goal. Assign a manufacturer to begin production.
          </p>
          <Link
            href="/manufacturers"
            className="text-xs text-[var(--text-primary)] underline hover:no-underline"
          >
            Find a manufacturer →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Backer list
// ─────────────────────────────────────────────

const BACKING_STATUS_COLORS: Record<string, string> = {
  active:    "text-[#22C55E]",
  cancelled: "text-red-500",
  refunded:  "text-orange-500",
  fulfilled: "text-blue-500",
};

function BackerList({ campaignId }: { campaignId: string }) {
  const [backings, setBackings] = useState<BackingSummary[]>([]);
  const [meta, setMeta] = useState<BackingListResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchBackings = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/back-it/campaigns/${campaignId}/backings?page=${p}&limit=20`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (!res.ok) return;
      const data = await res.json() as BackingListResponse;
      setBackings(data.data ?? []);
      setMeta(data.meta);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void fetchBackings(page);
  }, [fetchBackings, page]);

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--surface-3)] flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">Backers</h2>
        {meta && (
          <span className="text-sm text-[var(--text-tertiary)]">{meta.total.toLocaleString()} total</span>
        )}
      </div>

      {loading ? (
        <div className="divide-y divide-[var(--surface-3)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-2)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--surface-2)] rounded w-1/3" />
                <div className="h-3 bg-[var(--surface-2)] rounded w-1/4" />
              </div>
              <div className="h-3 bg-[var(--surface-2)] rounded w-16" />
            </div>
          ))}
        </div>
      ) : backings.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[var(--text-tertiary)] text-sm">No backings yet.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--surface-3)]">
            {backings.map((backing) => {
              const name = [backing.shippingAddress?.firstName, backing.shippingAddress?.lastName]
                .filter(Boolean)
                .join(" ") || "Anonymous";
              const location = [backing.shippingAddress?.city, backing.shippingAddress?.country]
                .filter(Boolean)
                .join(", ");
              const statusClass = BACKING_STATUS_COLORS[backing.status] ?? "text-[var(--text-tertiary)]";

              return (
                <div key={backing.id} className="px-6 py-3.5 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-medium text-[var(--text-secondary)] shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{name}</p>
                    {location && (
                      <p className="text-xs text-[var(--text-tertiary)] truncate">{location}</p>
                    )}
                  </div>

                  {/* Size */}
                  <div className="shrink-0 text-center">
                    <p className="text-xs text-[var(--text-tertiary)]">Size</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{backing.size}</p>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {backing.currency} {(backing.totalCents / 100).toFixed(2)}
                    </p>
                    <p className={`text-xs capitalize ${statusClass}`}>{backing.depositStatus}</p>
                  </div>

                  {/* Date */}
                  <div className="shrink-0 hidden sm:block text-right">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {new Date(backing.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[var(--surface-3)] flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                Page {page} of {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-[var(--surface-3)] rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page === meta.totalPages}
                  className="px-3 py-1.5 text-sm border border-[var(--surface-3)] rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page skeleton
// ─────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-8 max-w-screen-xl animate-pulse">
      <div className="h-8 bg-[var(--surface-2)] rounded w-72 mb-3" />
      <div className="h-5 bg-[var(--surface-2)] rounded w-48 mb-10" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="h-48 bg-[var(--surface-2)] rounded-[var(--radius-xl)]" />
          <div className="h-64 bg-[var(--surface-2)] rounded-[var(--radius-xl)]" />
          <div className="h-80 bg-[var(--surface-2)] rounded-[var(--radius-xl)]" />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-[var(--surface-2)] rounded-[var(--radius-xl)]" />
          <div className="h-64 bg-[var(--surface-2)] rounded-[var(--radius-xl)]" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [backingCount, setBackingCount] = useState(0);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/back-it/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const data = await res.json() as { data: Campaign };
      setCampaign(data.data);
      setBackingCount(data.data.currentBackingCount);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    void fetchCampaign();
  }, [fetchCampaign]);

  // Supabase Realtime for live backer count (active campaigns only)
  useEffect(() => {
    if (!campaign || !["active", "moq_reached", "funded"].includes(campaign.status)) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`brand-campaign:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${id}`,
        },
        (payload: { new: { current_backing_count?: number } }) => {
          if (payload.new.current_backing_count !== undefined) {
            setBackingCount(payload.new.current_backing_count);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, campaign?.status]);

  if (loading) return <PageSkeleton />;

  if (notFound || !campaign) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-4xl mb-4">🔍</p>
          <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">Campaign not found</h2>
          <p className="text-[var(--text-secondary)] mb-6">This campaign doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link
            href="/campaigns"
            className="px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const liveCount = backingCount;
  const revenueCents = liveCount * campaign.backerPriceCents;

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] mb-3">
        <Link href="/campaigns" className="hover:text-[var(--text-secondary)] transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">{campaign.title}</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-display text-3xl text-[var(--text-primary)]">
              {campaign.title}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            Created {new Date(campaign.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            <span className="font-mono text-xs text-[var(--text-tertiary)]">/{campaign.slug}</span>
          </p>
        </div>
      </div>

      {/* Main layout: 2-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Progress */}
          <ProgressSection
            count={liveCount}
            moq={campaign.moq}
            stretchGoalQty={campaign.stretchGoalQty}
            moqReached={campaign.moqReached}
            revenue={revenueCents}
            currency={campaign.currency}
          />

          {/* Size distribution */}
          <SizeDistribution
            sizeBreaks={campaign.sizeBreaks ?? []}
            totalBackers={liveCount}
          />

          {/* Pricing summary */}
          <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
            <h2 className="font-semibold text-[var(--text-primary)] mb-4">Pricing</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Retail price</p>
                <p className="font-semibold text-[var(--text-primary)]">
                  {campaign.currency} {(campaign.retailPriceCents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Backer price</p>
                <p className="font-semibold text-[#22C55E]">
                  {campaign.currency} {(campaign.backerPriceCents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Deposit</p>
                <p className="font-semibold text-[var(--text-primary)]">{campaign.depositPercent}%</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--surface-3)]">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">Revenue at MOQ ({campaign.moq} backers)</p>
              <p className="font-bold text-lg text-[var(--text-primary)]">
                {campaign.currency} {((campaign.moq * campaign.backerPriceCents) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Backer list */}
          <BackerList campaignId={campaign.id} />
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          <CampaignActions campaign={campaign} onStatusChange={() => void fetchCampaign()} />
          <TimelineCard campaign={campaign} />
        </div>
      </div>
    </div>
  );
}
