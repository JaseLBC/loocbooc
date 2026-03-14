/**
 * Brand Back It Campaigns — /campaigns
 *
 * Overview dashboard for all campaigns belonging to this brand.
 *
 * Layout:
 * - Header with summary stats (total, active, funded, total revenue)
 * - Status filter tabs (All | Draft | Active | MOQ Reached | Funded | Completed)
 * - Campaign grid — card per campaign with real-time progress, key metrics
 * - Empty state with CTA to create first campaign
 *
 * Architecture:
 * - "use client" — needs live progress bars and filter interaction
 * - Fetches from GET /api/v1/back-it/brands/:brandId/campaigns
 * - brandId is resolved from the auth token (via /api/v1/auth/me)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

interface CampaignSummary {
  id: string;
  title: string;
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
  campaignStart: string;
  campaignEnd: string;
  estimatedShipDate: string | null;
  createdAt: string;
}

interface CampaignListResponse {
  data: CampaignSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BrandProfile {
  id: string;
  brandId: string;
  name: string;
}

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

async function getBrandProfile(): Promise<BrandProfile | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { user?: { id: string; brandId?: string; brandName?: string } };
    if (!data.user?.brandId) return null;
    return { id: data.user.id, brandId: data.user.brandId, name: data.user.brandName ?? "My Brand" };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<CampaignStatus, { label: string; badge: string; dot: string }> = {
  draft:         { label: "Draft",         badge: "bg-[var(--surface-2)] text-[var(--text-tertiary)]",    dot: "bg-[var(--text-tertiary)]" },
  scheduled:     { label: "Scheduled",     badge: "bg-blue-50 text-blue-600",                              dot: "bg-blue-500" },
  active:        { label: "Live",          badge: "bg-[#22C55E]/10 text-[#22C55E]",                        dot: "bg-[#22C55E]" },
  moq_reached:   { label: "Goal Reached",  badge: "bg-indigo-50 text-indigo-600",                          dot: "bg-indigo-500" },
  funded:        { label: "Funded",        badge: "bg-indigo-50 text-indigo-700",                          dot: "bg-indigo-600" },
  in_production: { label: "In Production", badge: "bg-purple-50 text-purple-700",                          dot: "bg-purple-600" },
  shipped:       { label: "Shipped",       badge: "bg-sky-50 text-sky-700",                                dot: "bg-sky-500" },
  completed:     { label: "Completed",     badge: "bg-emerald-50 text-emerald-700",                        dot: "bg-emerald-500" },
  cancelled:     { label: "Cancelled",     badge: "bg-red-50 text-red-600",                                dot: "bg-red-400" },
  expired:       { label: "Expired",       badge: "bg-orange-50 text-orange-600",                          dot: "bg-orange-400" },
};

const FILTER_TABS: { label: string; value: string }[] = [
  { label: "All",          value: "all" },
  { label: "Draft",        value: "draft" },
  { label: "Live",         value: "active" },
  { label: "Goal Reached", value: "moq_reached" },
  { label: "Funded",       value: "funded" },
  { label: "Completed",    value: "completed" },
  { label: "Expired",      value: "expired" },
];

// ─────────────────────────────────────────────
// Progress bar (mini — no Supabase on list view)
// ─────────────────────────────────────────────

function MiniProgressBar({ count, moq }: { count: number; moq: number }) {
  const pct = Math.min(100, Math.round((count / moq) * 100));
  const isComplete = pct >= 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
        <span>
          <strong className="text-[var(--text-primary)]">{count.toLocaleString()}</strong> / {moq.toLocaleString()} backers
        </span>
        <span className={isComplete ? "text-[#22C55E] font-medium" : ""}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: isComplete ? "#22C55E" : "#6366f1",
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Campaign card
// ─────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const {
    id, title, status, currentBackingCount, moq, backerPriceCents, currency,
    campaignEnd, estimatedShipDate, coverImageUrl,
  } = campaign;

  const daysLeft = Math.max(0, Math.ceil((new Date(campaignEnd).getTime() - Date.now()) / 86400000));
  const totalRevenueCents = currentBackingCount * backerPriceCents;
  const isLive = status === "active";
  const showCountdown = isLive && daysLeft <= 7;

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-2)] transition-shadow overflow-hidden">
      {/* Cover image */}
      <div className="relative h-44 bg-[var(--surface-2)] overflow-hidden">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">👗</span>
            <span className="text-xs text-[var(--text-tertiary)]">No cover image</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={status} />
        </div>
        {showCountdown && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-red-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
            {daysLeft === 0 ? "Ends today" : `${daysLeft}d left`}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-semibold text-[var(--text-primary)] text-base leading-snug mb-4 line-clamp-2">
          {title}
        </h3>

        {/* MOQ progress */}
        <div className="mb-4">
          <MiniProgressBar count={currentBackingCount} moq={moq} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-[var(--surface-3)] pt-4 mb-4">
          <div>
            <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Revenue</p>
            <p className="font-semibold text-[var(--text-primary)]">
              {currency} {(totalRevenueCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Backer price</p>
            <p className="font-semibold text-[var(--text-primary)]">
              {currency} {(backerPriceCents / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-tertiary)] text-xs mb-0.5">End date</p>
            <p className="font-medium text-[var(--text-primary)]">
              {new Date(campaignEnd).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </p>
          </div>
          {estimatedShipDate && (
            <div>
              <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Est. ship</p>
              <p className="font-medium text-[var(--text-primary)]">
                {new Date(estimatedShipDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <Link
          href={`/campaigns/${id}`}
          className="block w-full py-2.5 text-center text-sm font-medium bg-[var(--surface-2)] text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--surface-3)] transition-colors"
        >
          View campaign →
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stats summary bar
// ─────────────────────────────────────────────

function StatsSummary({ campaigns }: { campaigns: CampaignSummary[] }) {
  const total = campaigns.length;
  const active = campaigns.filter((c) => c.status === "active").length;
  const funded = campaigns.filter((c) => ["funded", "in_production", "shipped", "completed"].includes(c.status)).length;
  const totalRevenueCents = campaigns.reduce(
    (sum, c) => sum + c.currentBackingCount * c.backerPriceCents,
    0,
  );
  const totalBackers = campaigns.reduce((sum, c) => sum + c.currentBackingCount, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--surface-3)] rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-1)] mb-8">
      {[
        { label: "Total campaigns", value: total.toString() },
        { label: "Live now",        value: active.toString() },
        { label: "Total backers",   value: totalBackers.toLocaleString() },
        { label: "Total revenue",   value: `AUD ${(totalRevenueCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-[var(--surface-1)] px-5 py-4">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">{label}</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function CampaignCardSkeleton() {
  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] overflow-hidden animate-pulse">
      <div className="h-44 bg-[var(--surface-2)]" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-[var(--surface-2)] rounded w-3/4" />
        <div className="h-2 bg-[var(--surface-2)] rounded-full w-full" />
        <div className="grid grid-cols-2 gap-3 pt-3">
          <div className="h-10 bg-[var(--surface-2)] rounded" />
          <div className="h-10 bg-[var(--surface-2)] rounded" />
        </div>
        <div className="h-10 bg-[var(--surface-2)] rounded" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [brandId, setBrandId] = useState<string | null>(null);

  // Resolve brandId on mount
  useEffect(() => {
    getBrandProfile().then((profile) => {
      if (profile) setBrandId(profile.brandId);
    }).catch(console.error);
  }, []);

  const fetchCampaigns = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (activeFilter !== "all") params.set("status", activeFilter);

      const res = await fetch(`/api/v1/back-it/brands/${brandId}/campaigns?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed to load campaigns");
      }
      const data = await res.json() as CampaignListResponse;
      setCampaigns(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [brandId, activeFilter]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const filteredCampaigns = activeFilter === "all"
    ? campaigns
    : campaigns.filter((c) => c.status === activeFilter);

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Page header */}
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            Back It Campaigns
          </h1>
          <p className="text-[var(--text-secondary)]">
            Create pre-production campaigns. Hit MOQ. Go to production.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <span>+</span>
          New campaign
        </Link>
      </header>

      {/* Stats summary — only when data loaded */}
      {!loading && campaigns.length > 0 && (
        <StatsSummary campaigns={campaigns} />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--surface-3)] overflow-x-auto pb-0">
        {FILTER_TABS.map((tab) => {
          const count = tab.value === "all"
            ? campaigns.length
            : campaigns.filter((c) => c.status === tab.value).length;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors -mb-px
                ${activeFilter === tab.value
                  ? "border-[var(--loocbooc-black)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--surface-3)]"
                }
              `}
            >
              {tab.label}
              {count > 0 && (
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${activeFilter === tab.value
                    ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
                    : "bg-[var(--surface-2)] text-[var(--text-tertiary)]"
                  }
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-[var(--radius-lg)] text-sm text-red-600 mb-6">
          {error}
          <button
            onClick={() => void fetchCampaigns()}
            className="ml-3 underline font-medium hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <CampaignCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredCampaigns.length === 0 && !error && (
        <div className="py-24 text-center">
          <p className="text-5xl mb-4">{activeFilter === "all" ? "🚀" : "📭"}</p>
          <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">
            {activeFilter === "all" ? "No campaigns yet" : `No ${activeFilter} campaigns`}
          </h2>
          <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto mb-6">
            {activeFilter === "all"
              ? "Create your first Back It campaign and start collecting pre-orders before you produce a single unit."
              : "You don't have any campaigns in this status."}
          </p>
          {activeFilter === "all" && (
            <Link
              href="/campaigns/new"
              className="inline-block px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Create your first campaign
            </Link>
          )}
        </div>
      )}

      {/* Campaign grid */}
      {!loading && filteredCampaigns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
