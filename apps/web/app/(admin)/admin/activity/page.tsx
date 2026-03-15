/**
 * Admin Activity — /admin/activity
 *
 * Full platform activity feed with filtering and auto-refresh.
 *
 * Shows all recent events across the platform:
 * - New backings (💳)
 * - Campaigns created (🚀)
 * - MOQ goals reached (🎉)
 * - User signups (👋)
 * - Manufacturer verifications (✅)
 *
 * Features:
 * - Paginated (50 items per page) — but initial load shows the most recent 50
 * - Type filter (All | Backings | Campaigns | Goals | Signups | Verifications)
 * - Auto-refresh toggle (60s interval)
 * - Revenue total for backing events visible in the stream
 *
 * API:
 *   GET /api/v1/admin/activity?limit=50
 *
 * Architecture: "use client" — filter/refresh interaction.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: "backing" | "campaign_created" | "campaign_moq" | "user_signup" | "manufacturer_verified";
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
// Activity type configuration
// ─────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<
  ActivityItem["type"],
  { icon: string; label: string; colour: string; dotColour: string }
> = {
  backing: {
    icon: "💳",
    label: "Backing",
    colour: "bg-indigo-50",
    dotColour: "bg-indigo-500",
  },
  campaign_created: {
    icon: "🚀",
    label: "Campaign created",
    colour: "bg-[var(--surface-2)]",
    dotColour: "bg-[var(--text-tertiary)]",
  },
  campaign_moq: {
    icon: "🎉",
    label: "Goal reached",
    colour: "bg-[#22C55E]/10",
    dotColour: "bg-[#22C55E]",
  },
  user_signup: {
    icon: "👋",
    label: "User signup",
    colour: "bg-blue-50",
    dotColour: "bg-blue-400",
  },
  manufacturer_verified: {
    icon: "✅",
    label: "Manufacturer verified",
    colour: "bg-emerald-50",
    dotColour: "bg-emerald-500",
  },
};

const TYPE_FILTERS: { value: string; label: string; icon: string }[] = [
  { value: "",                     label: "All activity",           icon: "📡" },
  { value: "backing",              label: "Backings",               icon: "💳" },
  { value: "campaign_created",     label: "Campaigns",              icon: "🚀" },
  { value: "campaign_moq",         label: "Goals reached",          icon: "🎉" },
  { value: "user_signup",          label: "Signups",                icon: "👋" },
  { value: "manufacturer_verified", label: "Verifications",         icon: "✅" },
];

// ─────────────────────────────────────────────
// Time formatting
// ─────────────────────────────────────────────

function formatRelative(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

function formatAbsolute(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─────────────────────────────────────────────
// Activity item
// ─────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const [showAbsolute, setShowAbsolute] = useState(false);
  const cfg = ACTIVITY_CONFIG[item.type] ?? {
    icon: "📌",
    label: item.type,
    colour: "bg-[var(--surface-2)]",
    dotColour: "bg-[var(--text-tertiary)]",
  };

  // Meta extras for backing events
  const isBackingWithMeta = item.type === "backing" && item.meta.amountCents;
  const amountFormatted = isBackingWithMeta
    ? `${String(item.meta.currency ?? "AUD")} ${(Number(item.meta.amountCents) / 100).toFixed(2)}`
    : null;

  return (
    <div className="flex items-start gap-4 py-4 border-b border-[var(--surface-3)] last:border-0">
      {/* Icon */}
      <div className={`
        w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${cfg.colour}
      `}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] leading-snug mb-1">
          {item.description}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Type badge */}
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColour} shrink-0`} />
            {cfg.label}
          </span>

          {/* Amount for backings */}
          {amountFormatted && (
            <span className="text-xs font-medium text-indigo-600">
              {amountFormatted}
            </span>
          )}

          {/* Timestamp */}
          <button
            onClick={() => setShowAbsolute((v) => !v)}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {showAbsolute ? formatAbsolute(item.timestamp) : formatRelative(item.timestamp)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Summary stats bar (live counts from current feed)
// ─────────────────────────────────────────────

function FeedSummary({ items }: { items: ActivityItem[] }) {
  const backingCount = items.filter((i) => i.type === "backing").length;
  const moqCount = items.filter((i) => i.type === "campaign_moq").length;
  const signupCount = items.filter((i) => i.type === "user_signup").length;
  const totalRevenueCents = items
    .filter((i) => i.type === "backing" && i.meta.amountCents)
    .reduce((sum, i) => sum + Number(i.meta.amountCents ?? 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--surface-3)] rounded-xl overflow-hidden mb-6">
      {[
        { label: "Backings in feed", value: backingCount.toLocaleString(), colour: "text-indigo-600" },
        {
          label: "Revenue in feed",
          value: `AUD ${(totalRevenueCents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`,
          colour: "text-[var(--text-primary)]",
        },
        { label: "Goals reached",   value: moqCount.toLocaleString(),    colour: "text-[#22C55E]" },
        { label: "New signups",      value: signupCount.toLocaleString(), colour: "text-blue-600" },
      ].map(({ label, value, colour }) => (
        <div key={label} className="bg-[var(--loocbooc-white)] px-5 py-4">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">{label}</p>
          <p className={`text-2xl font-bold ${colour}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdminActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [limit, setLimit] = useState(50);

  const fetchActivity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/activity?limit=${limit}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch activity");
      const data = await res.json() as { data: ActivityItem[] };
      setItems(data.data ?? []);
      setLastRefresh(new Date());
    } catch {
      // Non-fatal
    } finally {
      if (!silent) setLoading(false);
    }
  }, [limit]);

  // Initial load
  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => void fetchActivity(true), 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchActivity]);

  // Filtered items
  const filtered = typeFilter
    ? items.filter((i) => i.type === typeFilter)
    : items;

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            Activity
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Real-time platform event stream · showing last {limit} events
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lastRefresh && (
            <span className="text-xs text-[var(--text-tertiary)]">
              Updated {formatRelative(lastRefresh.toISOString())}
            </span>
          )}

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`
                relative w-9 h-5 rounded-full transition-colors
                ${autoRefresh ? "bg-[#22C55E]" : "bg-[var(--surface-3)]"}
              `}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              <div className={`
                absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${autoRefresh ? "translate-x-4" : "translate-x-0.5"}
              `} />
            </div>
            <span className="text-xs text-[var(--text-secondary)]">Auto-refresh</span>
          </label>

          <button
            onClick={() => void fetchActivity()}
            className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Summary stats */}
      {!loading && items.length > 0 && (
        <FeedSummary items={items} />
      )}

      {/* Type filters */}
      <div className="flex gap-1 border-b border-[var(--surface-3)] mb-6 overflow-x-auto">
        {TYPE_FILTERS.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setTypeFilter(value)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors -mb-px
              ${typeFilter === value
                ? "border-[var(--loocbooc-black)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--surface-3)]"
              }
            `}
          >
            <span>{icon}</span>
            <span>{label}</span>
            {value === "" && items.length > 0 && (
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-medium
                ${typeFilter === "" ? "bg-[var(--loocbooc-black)] text-white" : "bg-[var(--surface-2)] text-[var(--text-tertiary)]"}
              `}>
                {items.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity feed */}
      <div className="bg-[var(--loocbooc-white)] rounded-2xl border border-[var(--surface-3)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--surface-3)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">
            {typeFilter
              ? `${TYPE_FILTERS.find((t) => t.value === typeFilter)?.label ?? "Events"}`
              : "All events"
            }
            <span className="ml-2 text-sm font-normal text-[var(--text-tertiary)]">
              ({filtered.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-[var(--surface-3)]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-6 py-4 animate-pulse">
                <div className="w-9 h-9 bg-[var(--surface-2)] rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--surface-2)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--surface-2)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-[var(--text-secondary)] text-sm">
              No {typeFilter ? `"${typeFilter}" ` : ""}events in the current feed.
            </p>
          </div>
        ) : (
          <div className="px-6 divide-y divide-[var(--surface-3)]">
            {filtered.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Load more */}
      {!loading && filtered.length > 0 && (
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setLimit((l) => l + 50);
            }}
            className="px-6 py-2.5 text-sm border border-[var(--surface-3)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Load more events
          </button>
        </div>
      )}
    </div>
  );
}
