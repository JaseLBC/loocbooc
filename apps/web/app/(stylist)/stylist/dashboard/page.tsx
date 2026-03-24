"use client";

/**
 * Stylist dashboard — overview of activity, earnings, active briefs, quick stats.
 *
 * Sections:
 * - Earnings summary (this month vs last month)
 * - Active brief count with CTA
 * - Briefs needing action (delivered/in_progress older than 7 days)
 * - Quick access: open brief feed, portfolio
 * - Availability toggle
 *
 * API:
 *   GET /api/v1/stylists/me
 *   GET /api/v1/stylists/me/commissions
 *   GET /api/v1/briefs/mine?limit=5
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface StylistProfile {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  isAvailable: boolean;
  completedBriefs: number;
  commissionPercent: number;
  avgRating: number | null;
  ratingCount: number;
  createdAt: string;
}

interface CommissionSummary {
  totalEarnedCents: number;
  pendingCents: number;
  paidOutCents: number;
  commissionPercent: number;
  platformFeePercent: number;
  recentActivity: {
    date: string;
    productName: string;
    brandName: string;
    purchasePriceCents: number;
    commissionCents: number;
    status: "earned" | "paid";
  }[];
}

type BriefStatus = "open" | "assigned" | "in_progress" | "delivered" | "accepted" | "closed";

interface BriefSummary {
  id: string;
  title: string | null;
  occasion: string[];
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  status: BriefStatus;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCents(cents: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ─────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div style={{
      padding: "16px",
      background: accent ? "#0a0a0a" : "#fff",
      border: `1.5px solid ${accent ? "#0a0a0a" : "#e5e5e5"}`,
      borderRadius: 14,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, color: accent ? "#aaa" : "#888", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? "#fff" : "#0a0a0a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: accent ? "#888" : "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Brief row
// ─────────────────────────────────────────────

function ActiveBriefRow({ brief }: { brief: BriefSummary }) {
  const daysOld = daysSince(brief.updatedAt);
  const needsAttention = brief.status === "in_progress" && daysOld > 7;

  const STATUS_COLOR: Record<BriefStatus, string> = {
    open: "#d97706",
    assigned: "#1d4ed8",
    in_progress: "#1d4ed8",
    delivered: "#065f46",
    accepted: "#374151",
    closed: "#6b7280",
  };

  return (
    <Link
      href={`/stylist/briefs/${brief.id}`}
      style={{ textDecoration: "none" }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #f5f5f5",
        cursor: "pointer",
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0a0a0a", marginBottom: 3 }}>
            {brief.title ?? brief.occasion.join(", ") ?? "Style brief"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: STATUS_COLOR[brief.status],
              background: STATUS_COLOR[brief.status] + "15",
              padding: "2px 8px",
              borderRadius: 20,
            }}>
              {brief.status.replace("_", " ").toUpperCase()}
            </span>
            {needsAttention && (
              <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                ⚠️ {daysOld}d since update
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
          {brief.budgetMinCents && brief.budgetMaxCents
            ? formatCents(brief.budgetMinCents, brief.currency) + "–" + formatCents(brief.budgetMaxCents, brief.currency)
            : "Open budget"
          }
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Availability toggle
// ─────────────────────────────────────────────

function AvailabilityToggle({
  isAvailable,
  stylistId,
  onChange,
}: {
  isAvailable: boolean;
  stylistId: string;
  onChange: (val: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/stylists/${stylistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isAvailable: !isAvailable }),
      });
      if (res.ok) onChange(!isAvailable);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      background: isAvailable ? "#f0fdf4" : "#f9fafb",
      border: `1.5px solid ${isAvailable ? "#bbf7d0" : "#e5e5e5"}`,
      borderRadius: 12,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: isAvailable ? "#065f46" : "#374151" }}>
          {isAvailable ? "🟢 Available for briefs" : "🔴 Not accepting briefs"}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
          {isAvailable ? "Clients can assign you new briefs." : "You won't appear in the brief feed."}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          padding: "8px 16px",
          background: saving ? "#ddd" : "#0a0a0a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {saving ? "…" : (isAvailable ? "Go offline" : "Go online")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function StylistDashboardPage() {
  const [stylist, setStylist] = useState<StylistProfile | null>(null);
  const [commissions, setCommissions] = useState<CommissionSummary | null>(null);
  const [activeBriefs, setActiveBriefs] = useState<BriefSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [stylistRes, commissionsRes, briefsRes] = await Promise.all([
        fetch("/api/v1/stylists/me", { credentials: "include" }),
        fetch("/api/v1/stylists/me/commissions", { credentials: "include" }),
        fetch("/api/v1/briefs/mine?limit=10&status=active", { credentials: "include" }),
      ]);

      if (stylistRes.ok) {
        const data = await stylistRes.json() as { stylist: StylistProfile };
        setStylist(data.stylist);
      }
      if (commissionsRes.ok) {
        const data = await commissionsRes.json() as { commissions: CommissionSummary };
        setCommissions(data.commissions);
      }
      if (briefsRes.ok) {
        const data = await briefsRes.json() as { briefs: BriefSummary[] };
        setActiveBriefs(data.briefs.filter((b) => !["accepted", "closed"].includes(b.status)));
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading || !stylist) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ color: "#888", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const needsAttentionCount = activeBriefs.filter(
    (b) => b.status === "in_progress" && daysSince(b.updatedAt) > 7
  ).length;

  return (
    <div style={{ padding: "24px 20px 40px", maxWidth: 700, margin: "0 auto" }}>

      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Hey, {stylist.displayName.split(" ")[0]} 👋
        </h1>
        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
          {stylist.completedBriefs} brief{stylist.completedBriefs !== 1 ? "s" : ""} completed
          {stylist.avgRating ? ` · ★ ${stylist.avgRating.toFixed(1)} avg rating` : ""}
        </p>
      </div>

      {/* Availability toggle */}
      <div style={{ marginBottom: 20 }}>
        <AvailabilityToggle
          isAvailable={stylist.isAvailable}
          stylistId={stylist.id}
          onChange={(val) => setStylist((prev) => prev ? { ...prev, isAvailable: val } : prev)}
        />
      </div>

      {/* Needs attention alert */}
      {needsAttentionCount > 0 && (
        <div style={{
          padding: "12px 16px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 12,
          marginBottom: 20,
          fontSize: 14,
          color: "#dc2626",
          fontWeight: 600,
        }}>
          ⚠️ {needsAttentionCount} brief{needsAttentionCount > 1 ? "s" : ""} haven't been updated in 7+ days.{" "}
          <Link href="/stylist/briefs" style={{ color: "#dc2626", fontWeight: 700 }}>Review now →</Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard
          icon="💰"
          label="Pending earnings"
          value={formatCents(commissions?.pendingCents ?? 0)}
          sub="Not yet paid out"
          accent
        />
        <StatCard
          icon="📋"
          label="Active briefs"
          value={String(activeBriefs.length)}
          sub={activeBriefs.length > 0 ? "In your queue" : "All clear"}
        />
        <StatCard
          icon="✅"
          label="Total paid out"
          value={formatCents(commissions?.paidOutCents ?? 0)}
          sub="All time"
        />
      </div>

      {/* Active briefs */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Active briefs</div>
          <Link href="/stylist/briefs" style={{ fontSize: 13, color: "#555", textDecoration: "underline" }}>
            View all →
          </Link>
        </div>

        {activeBriefs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No active briefs</div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Browse the open brief feed to pick up new clients.
            </p>
            <Link
              href="/stylist/briefs"
              style={{
                padding: "10px 20px",
                background: "#0a0a0a",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Browse brief feed
            </Link>
          </div>
        ) : (
          <div style={{ border: "1.5px solid #e5e5e5", borderRadius: 14, padding: "4px 16px" }}>
            {activeBriefs.slice(0, 5).map((b) => (
              <ActiveBriefRow key={b.id} brief={b} />
            ))}
          </div>
        )}
      </div>

      {/* Recent earnings */}
      {commissions && commissions.recentActivity.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Recent earnings</div>
            <Link href="/stylist/commissions" style={{ fontSize: 13, color: "#555", textDecoration: "underline" }}>
              Full history →
            </Link>
          </div>
          <div style={{ border: "1.5px solid #e5e5e5", borderRadius: 14, overflow: "hidden" }}>
            {commissions.recentActivity.slice(0, 5).map((activity, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < commissions.recentActivity.slice(0, 5).length - 1 ? "1px solid #f5f5f5" : "none",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{activity.productName}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {activity.brandName} · {new Date(activity.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0a0a0a" }}>
                    +{formatCents(activity.commissionCents)}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: activity.status === "paid" ? "#16a34a" : "#d97706",
                    marginTop: 2,
                  }}>
                    {activity.status === "paid" ? "PAID" : "PENDING"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Link
          href={`/stylists/${stylist.slug}`}
          style={{
            padding: "14px",
            background: "#fff",
            border: "1.5px solid #e5e5e5",
            borderRadius: 12,
            textDecoration: "none",
            display: "block",
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 6 }}>👤</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0a0a0a" }}>My public profile</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>View as a client sees it</div>
        </Link>
        <Link
          href="/stylist/portfolio"
          style={{
            padding: "14px",
            background: "#fff",
            border: "1.5px solid #e5e5e5",
            borderRadius: 12,
            textDecoration: "none",
            display: "block",
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 6 }}>🖼️</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0a0a0a" }}>Portfolio</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Manage your work samples</div>
        </Link>
      </div>
    </div>
  );
}
