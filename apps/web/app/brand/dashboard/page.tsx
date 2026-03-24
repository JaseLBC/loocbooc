/**
 * Brand Dashboard Overview — /
 *
 * The central landing page for brands. Aggregates metrics and status across
 * all brand modules: Back It campaigns, PLM pipeline, manufacturer connections,
 * and garment library.
 *
 * Layout:
 * - Welcome header with brand name and quick actions
 * - Key metrics strip (revenue, active campaigns, production status, connections)
 * - Active campaigns summary with MOQ progress
 * - PLM pipeline snapshot (styles by stage, overdue/flagged counts)
 * - Recent activity feed
 * - Quick action cards for common tasks
 *
 * Data flow:
 * - Fetches brand profile from /api/v1/auth/me
 * - Fetches campaign summary from /api/v1/back-it/brands/:brandId/campaigns
 * - Fetches PLM dashboard from /api/v1/plm/brands/:brandId/dashboard
 * - Fetches manufacturer connections from /api/v1/manufacturers/connections
 * - Fetches garment stats from /api/v1/brand/stats
 *
 * Architecture:
 * - "use client" — interactive dashboard with live data
 * - Parallel data fetching for performance
 * - Skeleton loading states
 * - Error boundaries per section
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface BrandProfile {
  id: string;
  brandId: string;
  brandName: string;
  email: string;
  fullName: string | null;
}

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
  backerPriceCents: number;
  currency: string;
  moq: number;
  currentBackingCount: number;
  campaignEnd: string;
  estimatedShipDate: string | null;
}

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
  stage: PLMStage;
  costFlag: boolean;
  isOverdue: boolean;
  stageAgeDays: number;
}

interface PLMDashboard {
  brandId: string;
  totalStyles: number;
  costFlaggedCount: number;
  overdueCount: number;
  stageGroups: Array<{ stage: PLMStage; records: PLMRecordSummary[] }>;
}

interface ManufacturerConnection {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  logoUrl: string | null;
  country: string;
  status: "pending" | "active" | "declined" | "ended";
  activeOrdersCount: number;
}

interface GarmentStats {
  totalGarments: number;
  garmentsWith3D: number;
  totalTryOns: number;
  lastActivityAt: string | null;
}

interface DashboardData {
  campaigns: CampaignSummary[];
  plm: PLMDashboard | null;
  connections: ManufacturerConnection[];
  garmentStats: GarmentStats | null;
}

// ─────────────────────────────────────────────
// Auth & API helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getBrandProfile(): Promise<BrandProfile | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/v1/auth/me", { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json() as {
      user?: {
        id: string;
        email: string;
        fullName?: string;
        brandId?: string;
        brandName?: string;
      };
    };
    if (!data.user?.brandId) return null;
    return {
      id: data.user.id,
      brandId: data.user.brandId,
      brandName: data.user.brandName ?? "My Brand",
      email: data.user.email,
      fullName: data.user.fullName ?? null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft:         { label: "Draft",         color: "#666",    bg: "#f5f5f5" },
  scheduled:     { label: "Scheduled",     color: "#2563eb", bg: "#dbeafe" },
  active:        { label: "Live",          color: "#16a34a", bg: "#dcfce7" },
  moq_reached:   { label: "Goal Reached",  color: "#7c3aed", bg: "#ede9fe" },
  funded:        { label: "Funded",        color: "#7c3aed", bg: "#ede9fe" },
  in_production: { label: "In Production", color: "#9333ea", bg: "#f3e8ff" },
  shipped:       { label: "Shipped",       color: "#0891b2", bg: "#cffafe" },
  completed:     { label: "Completed",     color: "#059669", bg: "#d1fae5" },
  cancelled:     { label: "Cancelled",     color: "#dc2626", bg: "#fee2e2" },
  expired:       { label: "Expired",       color: "#ea580c", bg: "#ffedd5" },
};

const PLM_STAGE_GROUPS: Array<{ label: string; stages: PLMStage[] }> = [
  {
    label: "Design",
    stages: ["DESIGN", "TECH_PACK_SENT", "TECH_PACK_APPROVED"],
  },
  {
    label: "Sampling",
    stages: [
      "SAMPLE_ORDERED", "SAMPLE_IN_PRODUCTION", "SAMPLE_SHIPPED",
      "SAMPLE_RECEIVED", "FIT_SESSION", "ADJUSTMENTS_SENT",
      "COUNTER_SAMPLE_REQUESTED", "COUNTER_SAMPLE_SHIPPED", "COUNTER_SAMPLE_RECEIVED",
    ],
  },
  {
    label: "Production",
    stages: ["BULK_APPROVED", "IN_PRODUCTION", "SHIPPED", "DELIVERED"],
  },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtext,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  subtext?: string | null;
  color?: string | null;
  icon?: string;
}) {
  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p
        className="text-2xl font-bold leading-tight"
        style={{ color: color || "var(--text-primary)" }}
      >
        {value}
      </p>
      {subtext ? (
        <p className="text-xs text-[var(--text-tertiary)] mt-1">{subtext}</p>
      ) : null}
    </div>
  );
}

function CampaignMiniCard({ campaign }: { campaign: CampaignSummary }) {
  const { id, title, status, moq, currentBackingCount, backerPriceCents, currency, campaignEnd } = campaign;
  const pct = Math.min(100, Math.round((currentBackingCount / moq) * 100));
  const cfg = STATUS_CONFIG[status];
  const daysLeft = Math.max(0, Math.ceil((new Date(campaignEnd).getTime() - Date.now()) / 86400000));
  const isLive = status === "active";
  const revenue = currentBackingCount * backerPriceCents;

  return (
    <Link
      href={`/campaigns/${id}`}
      className="block bg-[var(--surface-1)] rounded-[var(--radius-lg)] border border-[var(--surface-3)] p-4 hover:shadow-[var(--shadow-2)] transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="font-medium text-[var(--text-primary)] text-sm leading-snug line-clamp-2 flex-1">
          {title}
        </h4>
        <span
          className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase"
          style={{ color: cfg.color, backgroundColor: cfg.bg }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
          <span>
            <strong className="text-[var(--text-primary)]">{currentBackingCount}</strong> / {moq}
          </span>
          <span className={pct >= 100 ? "text-[#16a34a] font-medium" : ""}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct >= 100 ? "#16a34a" : "#6366f1",
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>{currency} {(revenue / 100).toLocaleString()}</span>
        {isLive && daysLeft <= 7 && (
          <span className="text-amber-600 font-medium">
            {daysLeft === 0 ? "Ends today" : `${daysLeft}d left`}
          </span>
        )}
        {!isLive && status !== "draft" && status !== "scheduled" && (
          <span>{new Date(campaignEnd).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
        )}
      </div>
    </Link>
  );
}

function PLMSnapshot({ plm }: { plm: PLMDashboard }) {
  // Count styles per group
  const groupCounts = PLM_STAGE_GROUPS.map((group) => {
    const count = plm.stageGroups
      .filter((sg) => group.stages.includes(sg.stage))
      .reduce((sum, sg) => sum + sg.records.length, 0);
    return { label: group.label, count };
  });

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">PLM Pipeline</h3>
        <Link href="/plm" className="text-xs text-[var(--loocbooc-black)] hover:underline">
          View all →
        </Link>
      </div>

      {/* Stage groups */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {groupCounts.map(({ label, count }) => (
          <div
            key={label}
            className="bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 text-center"
          >
            <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(plm.costFlaggedCount > 0 || plm.overdueCount > 0) && (
        <div className="space-y-2">
          {plm.costFlaggedCount > 0 && (
            <Link
              href="/plm?filter=cost-flagged"
              className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[var(--radius-md)] text-sm text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <span>⚠️</span>
              <span>
                <strong>{plm.costFlaggedCount}</strong> style{plm.costFlaggedCount !== 1 ? "s" : ""} over budget
              </span>
            </Link>
          )}
          {plm.overdueCount > 0 && (
            <Link
              href="/plm?filter=overdue"
              className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-[var(--radius-md)] text-sm text-red-700 hover:bg-red-100 transition-colors"
            >
              <span>🚨</span>
              <span>
                <strong>{plm.overdueCount}</strong> style{plm.overdueCount !== 1 ? "s" : ""} overdue
              </span>
            </Link>
          )}
        </div>
      )}

      {plm.totalStyles === 0 && (
        <div className="text-center py-4">
          <p className="text-[var(--text-tertiary)] text-sm mb-2">No styles in your PLM yet</p>
          <Link
            href="/plm"
            className="text-xs text-[var(--loocbooc-black)] hover:underline"
          >
            Start tracking →
          </Link>
        </div>
      )}
    </div>
  );
}

function ManufacturerSnapshot({ connections }: { connections: ManufacturerConnection[] }) {
  const active = connections.filter((c) => c.status === "active");
  const pending = connections.filter((c) => c.status === "pending");

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Manufacturers</h3>
        <Link href="/manufacturers/connections" className="text-xs text-[var(--loocbooc-black)] hover:underline">
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{active.length}</p>
          <p className="text-xs text-[var(--text-tertiary)]">Active</p>
        </div>
        <div className="bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{pending.length}</p>
          <p className="text-xs text-[var(--text-tertiary)]">Pending</p>
        </div>
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          {active.slice(0, 3).map((conn) => (
            <Link
              key={conn.id}
              href={`/manufacturers/${conn.manufacturerId}`}
              className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="w-8 h-8 bg-[var(--surface-3)] rounded-full flex items-center justify-center text-xs font-medium">
                {conn.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={conn.logoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  conn.manufacturerName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {conn.manufacturerName}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">{conn.country}</p>
              </div>
              {conn.activeOrdersCount > 0 && (
                <span className="text-xs bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
                  {conn.activeOrdersCount} order{conn.activeOrdersCount !== 1 ? "s" : ""}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {connections.length === 0 && (
        <div className="text-center py-4">
          <p className="text-[var(--text-tertiary)] text-sm mb-2">No manufacturer connections yet</p>
          <Link
            href="/manufacturers"
            className="text-xs text-[var(--loocbooc-black)] hover:underline"
          >
            Find manufacturers →
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 p-4 bg-[var(--surface-1)] rounded-[var(--radius-lg)] border border-[var(--surface-3)] hover:shadow-[var(--shadow-2)] hover:border-[var(--surface-4)] transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-medium text-[var(--text-primary)] text-sm mb-0.5">{title}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
    </Link>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[var(--surface-2)] rounded-[var(--radius-lg)] ${className ?? ""}`} />
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function BrandDashboardPage() {
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const profile = await getBrandProfile();
      if (!profile) {
        setError("Unable to load brand profile");
        setLoading(false);
        return;
      }
      setBrand(profile);

      // Fetch all dashboard data in parallel
      const [campaignsRes, plmRes, connectionsRes, statsRes] = await Promise.allSettled([
        fetch(`/api/v1/back-it/brands/${profile.brandId}/campaigns?limit=50`, { headers: authHeaders() }),
        fetch(`/api/v1/plm/brands/${profile.brandId}/dashboard`, { headers: authHeaders() }),
        fetch(`/api/v1/manufacturers/connections`, { headers: authHeaders() }),
        fetch(`/api/v1/brand/stats`, { headers: authHeaders() }),
      ]);

      const dashboardData: DashboardData = {
        campaigns: [],
        plm: null,
        connections: [],
        garmentStats: null,
      };

      // Parse campaigns
      if (campaignsRes.status === "fulfilled" && campaignsRes.value.ok) {
        const json = await campaignsRes.value.json() as { data?: CampaignSummary[] };
        dashboardData.campaigns = json.data ?? [];
      }

      // Parse PLM
      if (plmRes.status === "fulfilled" && plmRes.value.ok) {
        const json = await plmRes.value.json() as { data?: PLMDashboard };
        dashboardData.plm = json.data ?? null;
      }

      // Parse connections
      if (connectionsRes.status === "fulfilled" && connectionsRes.value.ok) {
        const json = await connectionsRes.value.json() as { data?: ManufacturerConnection[] };
        dashboardData.connections = json.data ?? [];
      }

      // Parse garment stats
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const json = await statsRes.value.json() as GarmentStats;
        dashboardData.garmentStats = json;
      }

      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 max-w-screen-xl">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-96 mb-8" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-8 max-w-screen-xl">
        <div className="bg-red-50 border border-red-200 rounded-[var(--radius-xl)] p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => void fetchDashboard()}
            className="px-4 py-2 bg-red-600 text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── Computed metrics ──────────────────────────────────────────────────────

  const campaigns = data?.campaigns ?? [];
  const plm = data?.plm ?? null;
  const connections = data?.connections ?? [];
  const garmentStats = data?.garmentStats ?? null;

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const fundedCampaigns = campaigns.filter((c) =>
    ["moq_reached", "funded", "in_production", "shipped", "completed"].includes(c.status)
  );
  const totalRevenueCents = campaigns.reduce(
    (sum, c) => sum + c.currentBackingCount * c.backerPriceCents,
    0
  );
  const totalBackers = campaigns.reduce((sum, c) => sum + c.currentBackingCount, 0);
  const activeConnections = connections.filter((c) => c.status === "active").length;
  const inProduction = plm?.stageGroups
    .filter((sg) => ["IN_PRODUCTION", "SHIPPED"].includes(sg.stage))
    .reduce((sum, sg) => sum + sg.records.length, 0) ?? 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
          {getGreeting()}, {brand?.fullName?.split(" ")[0] ?? brand?.brandName ?? "there"}
        </h1>
        <p className="text-[var(--text-secondary)]">
          Here's what's happening at <strong>{brand?.brandName}</strong> today.
        </p>
      </header>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Revenue"
          value={`$${(totalRevenueCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
          subtext={`${totalBackers.toLocaleString()} total backers`}
          icon="💰"
        />
        <MetricCard
          label="Active Campaigns"
          value={activeCampaigns.length}
          subtext={`${fundedCampaigns.length} funded`}
          color={activeCampaigns.length > 0 ? "#16a34a" : null}
          icon="🚀"
        />
        <MetricCard
          label="In Production"
          value={inProduction}
          subtext={plm ? `${plm.totalStyles} total styles` : null}
          icon="🏭"
        />
        <MetricCard
          label="Manufacturers"
          value={activeConnections}
          subtext="active connections"
          icon="🤝"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Active campaigns (takes 2 cols) */}
        <div className="lg:col-span-2 bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Active Campaigns
              {activeCampaigns.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">
                  ({activeCampaigns.length})
                </span>
              )}
            </h3>
            <Link href="/campaigns" className="text-xs text-[var(--loocbooc-black)] hover:underline">
              View all →
            </Link>
          </div>

          {activeCampaigns.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeCampaigns.slice(0, 4).map((campaign) => (
                <CampaignMiniCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🚀</p>
              <p className="text-[var(--text-secondary)] mb-4">No active campaigns right now</p>
              <Link
                href="/campaigns/new"
                className="inline-block px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Create a campaign
              </Link>
            </div>
          )}
        </div>

        {/* PLM snapshot */}
        {plm && <PLMSnapshot plm={plm} />}
        {!plm && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">PLM Pipeline</h3>
            <div className="text-center py-4">
              <p className="text-[var(--text-tertiary)] text-sm mb-2">No PLM data available</p>
              <Link href="/plm" className="text-xs text-[var(--loocbooc-black)] hover:underline">
                Go to PLM →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Secondary content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Manufacturer connections */}
        <ManufacturerSnapshot connections={connections} />

        {/* Garment library stats */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Garment Library</h3>
            <Link href="/garments" className="text-xs text-[var(--loocbooc-black)] hover:underline">
              View all →
            </Link>
          </div>

          {garmentStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {garmentStats.totalGarments}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">Total</p>
                </div>
                <div className="bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {garmentStats.garmentsWith3D}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">With 3D</p>
                </div>
              </div>

              {garmentStats.totalTryOns > 0 && (
                <div className="bg-indigo-50 rounded-[var(--radius-md)] p-3 text-center">
                  <p className="text-lg font-bold text-indigo-700">
                    {garmentStats.totalTryOns.toLocaleString()}
                  </p>
                  <p className="text-xs text-indigo-600">Virtual try-ons</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[var(--text-tertiary)] text-sm mb-2">No garments yet</p>
              <Link href="/garments/new" className="text-xs text-[var(--loocbooc-black)] hover:underline">
                Add your first garment →
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <QuickAction
              icon="🚀"
              title="Create Campaign"
              description="Launch a new Back It campaign"
              href="/campaigns/new"
            />
            <QuickAction
              icon="👗"
              title="Add Garment"
              description="Upload a new style to your library"
              href="/garments/new"
            />
            <QuickAction
              icon="🔍"
              title="Find Manufacturers"
              description="Browse verified manufacturers"
              href="/manufacturers"
            />
            <QuickAction
              icon="📐"
              title="Size Charts"
              description="Manage your brand's size charts"
              href="/size-charts"
            />
          </div>
        </div>
      </div>

      {/* Recent funded campaigns (if any) */}
      {fundedCampaigns.length > 0 && (
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Recently Funded
              <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">
                ({fundedCampaigns.length})
              </span>
            </h3>
            <Link href="/campaigns?filter=funded" className="text-xs text-[var(--loocbooc-black)] hover:underline">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {fundedCampaigns.slice(0, 4).map((campaign) => (
              <CampaignMiniCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
