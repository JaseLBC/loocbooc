/**
 * Admin Overview — /admin
 *
 * Platform-wide stats at a glance:
 * - Campaign pipeline counts by status
 * - User totals by role
 * - Backing & revenue summary
 * - Manufacturer verification queue status
 * - Recent activity feed
 *
 * All data fetched client-side (admin is not indexed by search engines).
 * Auto-refreshes every 60 seconds.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PlatformStats {
  campaigns: {
    total: number;
    active: number;
    moqReached: number;
    funded: number;
    inProduction: number;
    shipped: number;
    completed: number;
    expired: number;
    draft: number;
  };
  users: {
    total: number;
    brands: number;
    manufacturers: number;
    consumers: number;
    admins: number;
    newLast7Days: number;
  };
  backings: {
    total: number;
    active: number;
    refunded: number;
    fulfilled: number;
    totalRevenueCents: number;
    last24hCount: number;
  };
  manufacturers: {
    total: number;
    verified: number;
    pendingVerification: number;
  };
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  meta: Record<string, string | number>;
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

// ─────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  colour,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colour?: string;
  href?: string;
}) {
  const content = (
    <div className={`
      bg-[var(--surface-1)] rounded-xl border border-[var(--surface-3)]
      px-5 py-4 flex flex-col gap-1
      ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}
    `}>
      <p className="text-xs text-[var(--text-tertiary)] font-medium">{label}</p>
      <p className={`text-3xl font-bold leading-none ${colour ?? "text-[var(--text-primary)]"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-[var(--text-tertiary)]">{sub}</p>}
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// ─────────────────────────────────────────────
// Activity icons
// ─────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, string> = {
  backing: "💳",
  campaign_created: "🚀",
  campaign_moq: "🎉",
  user_signup: "👋",
  manufacturer_verified: "✅",
};

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">No recent activity.</p>;
  }

  return (
    <div className="divide-y divide-[var(--surface-3)]">
      {items.map((item) => {
        const icon = ACTIVITY_ICONS[item.type] ?? "📌";
        const time = new Date(item.timestamp);
        const relativeTime = formatRelative(time);

        return (
          <div key={item.id} className="flex items-start gap-3 py-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-sm shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)] leading-snug">{item.description}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{relativeTime}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 bg-[var(--surface-2)] rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Campaign pipeline bar
// ─────────────────────────────────────────────

function CampaignPipeline({ campaigns }: { campaigns: PlatformStats["campaigns"] }) {
  const stages = [
    { label: "Draft",          value: campaigns.draft,         colour: "bg-slate-300" },
    { label: "Active",         value: campaigns.active,        colour: "bg-[#22C55E]" },
    { label: "Goal Reached",   value: campaigns.moqReached,    colour: "bg-indigo-500" },
    { label: "Funded",         value: campaigns.funded,        colour: "bg-indigo-600" },
    { label: "In Production",  value: campaigns.inProduction,  colour: "bg-purple-600" },
    { label: "Shipped",        value: campaigns.shipped,       colour: "bg-sky-500" },
    { label: "Completed",      value: campaigns.completed,     colour: "bg-emerald-500" },
    { label: "Expired",        value: campaigns.expired,       colour: "bg-orange-400" },
  ];
  const total = campaigns.total || 1;

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4 bg-[var(--surface-2)]">
        {stages.filter((s) => s.value > 0).map((stage) => (
          <div
            key={stage.label}
            className={`h-full ${stage.colour} transition-all`}
            style={{ width: `${(stage.value / total) * 100}%` }}
            title={`${stage.label}: ${stage.value}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${stage.colour} shrink-0`} />
            <span className="text-xs text-[var(--text-secondary)]">{stage.label}</span>
            <span className="text-xs font-semibold text-[var(--text-primary)] ml-auto">{stage.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch("/api/v1/admin/stats", { headers }),
        fetch("/api/v1/admin/activity?limit=15", { headers }),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json() as { data: PlatformStats };
        setStats(d.data);
      }
      if (activityRes.ok) {
        const d = await activityRes.json() as { data: ActivityItem[] };
        setActivity(d.data ?? []);
      }
      setLastRefresh(new Date());
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            Platform overview
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Loocbooc admin · Real-time platform health
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-xs text-[var(--text-tertiary)]">
              Updated {formatRelative(lastRefresh)}
            </span>
          )}
          <button
            onClick={() => void fetchData()}
            className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <StatsSkeleton />
      ) : stats ? (
        <>
          {/* Top-level KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total campaigns"
              value={stats.campaigns.total}
              sub={`${stats.campaigns.active} live now`}
              href="/admin/campaigns"
            />
            <StatCard
              label="Active live campaigns"
              value={stats.campaigns.active}
              colour="text-[#22C55E]"
              href="/admin/campaigns?status=active"
            />
            <StatCard
              label="Total users"
              value={stats.users.total}
              sub={`+${stats.users.newLast7Days} this week`}
              href="/admin/users"
            />
            <StatCard
              label="Total backers (active)"
              value={stats.backings.active}
              sub={`${stats.backings.last24hCount} in last 24h`}
            />
          </div>

          {/* Revenue + backings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total revenue"
              value={`AUD ${(stats.backings.totalRevenueCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
              sub="Across all backings"
            />
            <StatCard
              label="Total backings"
              value={stats.backings.total}
              sub={`${stats.backings.refunded} refunded`}
            />
            <StatCard
              label="Pending verification"
              value={stats.manufacturers.pendingVerification}
              colour={stats.manufacturers.pendingVerification > 0 ? "text-amber-600" : undefined}
              sub={`${stats.manufacturers.verified} verified total`}
              href="/admin/manufacturers"
            />
            <StatCard
              label="Goal reached (active)"
              value={stats.campaigns.moqReached + stats.campaigns.funded}
              colour="text-indigo-600"
              sub="In production pipeline"
            />
          </div>

          {/* Campaign pipeline */}
          <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--surface-3)] p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-[var(--text-primary)]">Campaign pipeline</h2>
              <Link
                href="/admin/campaigns"
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                View all →
              </Link>
            </div>
            <CampaignPipeline campaigns={stats.campaigns} />
          </div>

          {/* Users by role */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--surface-3)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-[var(--text-primary)]">Users by role</h2>
                <Link
                  href="/admin/users"
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Manage →
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Brands",         value: stats.users.brands,        icon: "🏷" },
                  { label: "Manufacturers",  value: stats.users.manufacturers, icon: "🏭" },
                  { label: "Consumers",      value: stats.users.consumers,     icon: "👤" },
                  { label: "Admins",         value: stats.users.admins,        icon: "🛡" },
                ].map(({ label, value, icon }) => {
                  const pct = stats.users.total > 0 ? (value / stats.users.total) * 100 : 0;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-sm w-6">{icon}</span>
                      <span className="text-sm text-[var(--text-secondary)] w-28">{label}</span>
                      <div className="flex-1 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--loocbooc-black)] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)] w-12 text-right">
                        {value.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manufacturer stats */}
            <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--surface-3)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-[var(--text-primary)]">Manufacturers</h2>
                <Link
                  href="/admin/manufacturers"
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {stats.manufacturers.pendingVerification > 0
                    ? `${stats.manufacturers.pendingVerification} pending →`
                    : "View all →"}
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[var(--surface-3)] rounded-lg overflow-hidden mb-4">
                {[
                  { label: "Total",    value: stats.manufacturers.total,               colour: "text-[var(--text-primary)]" },
                  { label: "Verified", value: stats.manufacturers.verified,            colour: "text-[#22C55E]" },
                  { label: "Pending",  value: stats.manufacturers.pendingVerification, colour: stats.manufacturers.pendingVerification > 0 ? "text-amber-600" : "text-[var(--text-tertiary)]" },
                ].map(({ label, value, colour }) => (
                  <div key={label} className="bg-[var(--surface-1)] px-4 py-3 text-center">
                    <p className={`text-2xl font-bold ${colour}`}>{value}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
                  </div>
                ))}
              </div>
              {stats.manufacturers.pendingVerification > 0 && (
                <Link
                  href="/admin/manufacturers"
                  className="block w-full py-2.5 text-center text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 rounded-md hover:bg-amber-100 transition-colors"
                >
                  ⚠ Review {stats.manufacturers.pendingVerification} pending verification{stats.manufacturers.pendingVerification !== 1 ? "s" : ""}
                </Link>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          Failed to load platform stats.
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--surface-3)] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-[var(--text-primary)]">Recent activity</h2>
          <span className="text-xs text-[var(--text-tertiary)]">Last 20 events</span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[var(--surface-2)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--surface-2)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ActivityFeed items={activity} />
        )}
      </div>
    </div>
  );
}
