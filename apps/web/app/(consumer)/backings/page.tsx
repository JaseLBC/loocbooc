/**
 * Consumer Backings — /backings
 *
 * The account page where a consumer can see every campaign they've backed,
 * the current status of each backing, and track production progress.
 *
 * This page answers the question: "What have I backed and where is it?"
 *
 * Layout:
 * - Header with title and total backing count
 * - Status filter tabs: All | Active | Funded | In Production | Shipped | Completed | Refunded
 * - Backing cards — one per backing, showing campaign thumbnail, title, size,
 *   amount paid, status badge, and progress indicator
 * - Empty state for new users
 *
 * Data: GET /api/v1/users/me/backings?limit=20&offset=0
 *
 * Authentication: redirect to /login if not authenticated.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BackingStatus = "active" | "cancelled" | "refunded" | "fulfilled";
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

interface BackingCampaign {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  coverImageUrl: string | null;
  moq: number;
  currentBackingCount: number;
  moqReached: boolean;
  estimatedShipDate: string | null;
  campaignEnd: string;
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
}

interface BackingSummary {
  id: string;
  size: string;
  quantity: number;
  totalCents: number;
  depositCents: number;
  remainingCents: number;
  currency: string;
  depositStatus: string;
  finalPaymentStatus: string;
  status: BackingStatus;
  createdAt: string;
  cancelledAt: string | null;
  refundedAt: string | null;
  campaign: BackingCampaign;
}

interface BackingsResponse {
  data: BackingSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ─────────────────────────────────────────────
// Status display helpers
// ─────────────────────────────────────────────

const CAMPAIGN_STATUS_DISPLAY: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft:         { label: "Draft",          color: "#999",    bg: "#f5f5f5" },
  scheduled:     { label: "Scheduled",      color: "#7c3aed", bg: "#f5f3ff" },
  active:        { label: "Live",           color: "#0369a1", bg: "#e0f2fe" },
  moq_reached:   { label: "Goal reached",   color: "#065f46", bg: "#d1fae5" },
  funded:        { label: "Funded",         color: "#065f46", bg: "#d1fae5" },
  in_production: { label: "In production",  color: "#92400e", bg: "#fef3c7" },
  shipped:       { label: "Shipped",        color: "#1e40af", bg: "#dbeafe" },
  completed:     { label: "Delivered",      color: "#166534", bg: "#dcfce7" },
  cancelled:     { label: "Cancelled",      color: "#991b1b", bg: "#fee2e2" },
  expired:       { label: "Expired",        color: "#6b7280", bg: "#f3f4f6" },
};

const BACKING_STATUS_DISPLAY: Record<BackingStatus, { label: string; color: string }> = {
  active:    { label: "Active",    color: "#0369a1" },
  cancelled: { label: "Cancelled", color: "#991b1b" },
  refunded:  { label: "Refunded",  color: "#6b7280" },
  fulfilled: { label: "Fulfilled", color: "#166534" },
};

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

// ─────────────────────────────────────────────
// Filter config
// ─────────────────────────────────────────────

type FilterTab = "all" | "active" | "funded" | "in_production" | "shipped" | "completed" | "refunded";

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all",           label: "All" },
  { id: "active",        label: "Active" },
  { id: "funded",        label: "Funded" },
  { id: "in_production", label: "In Production" },
  { id: "shipped",       label: "Shipped" },
  { id: "completed",     label: "Completed" },
  { id: "refunded",      label: "Refunded" },
];

function matchesFilter(backing: BackingSummary, filter: FilterTab): boolean {
  if (filter === "all") return true;
  if (filter === "refunded") return backing.status === "refunded";
  if (filter === "active") return backing.status === "active" && backing.campaign.status === "active";
  if (filter === "funded") return backing.campaign.status === "funded" || backing.campaign.status === "moq_reached";
  if (filter === "in_production") return backing.campaign.status === "in_production";
  if (filter === "shipped") return backing.campaign.status === "shipped";
  if (filter === "completed") return backing.campaign.status === "completed" || backing.status === "fulfilled";
  return false;
}

// ─────────────────────────────────────────────
// Backing card
// ─────────────────────────────────────────────

function BackingCard({ backing }: { backing: BackingSummary }) {
  const campaignBadge = CAMPAIGN_STATUS_DISPLAY[backing.campaign.status];
  const backingBadge = BACKING_STATUS_DISPLAY[backing.status];
  const progressPct = backing.campaign.moq > 0
    ? Math.min(100, Math.round((backing.campaign.currentBackingCount / backing.campaign.moq) * 100))
    : 0;

  const isActive = backing.campaign.status === "active";
  const isShipped = backing.campaign.status === "shipped";
  const isCompleted = ["completed"].includes(backing.campaign.status);
  const hasRemainingBalance = backing.remainingCents > 0 && backing.finalPaymentStatus === "pending";

  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        transition: "box-shadow 0.15s ease",
      }}
      className="hover:shadow-md"
    >
      {/* Campaign thumbnail strip */}
      <div style={{ position: "relative", height: 120, background: "#f5f5f5", overflow: "hidden" }}>
        {backing.campaign.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backing.campaign.coverImageUrl}
            alt={backing.campaign.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            👗
          </div>
        )}

        {/* Campaign status badge */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: campaignBadge.bg,
            color: campaignBadge.color,
          }}
        >
          {campaignBadge.label}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "16px 16px 14px" }}>
        {/* Brand + title */}
        <p style={{ fontSize: 11, color: "#999", margin: "0 0 4px", fontWeight: 500 }}>
          {backing.campaign.brand.name}
        </p>
        <Link
          href={`/back/${backing.campaign.slug}`}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#0a0a0a",
            textDecoration: "none",
            display: "block",
            marginBottom: 12,
            lineHeight: 1.3,
          }}
        >
          {backing.campaign.title}
        </Link>

        {/* Your backing details */}
        <div
          style={{
            background: "#fafafa",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <div>
            <p style={{ fontSize: 10, color: "#aaa", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Size
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", margin: 0 }}>
              {backing.size}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: "#aaa", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Qty
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", margin: 0 }}>
              {backing.quantity}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: "#aaa", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Paid
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", margin: 0 }}>
              {formatCents(backing.depositCents, backing.currency)}
            </p>
          </div>
        </div>

        {/* Remaining balance warning */}
        {hasRemainingBalance && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 12,
              fontSize: 12,
              color: "#9a3412",
              lineHeight: 1.5,
            }}
          >
            <strong>Balance due:</strong> {formatCents(backing.remainingCents, backing.currency)} will be
            charged when this campaign hits its goal.
          </div>
        )}

        {/* Progress bar (only for active campaigns) */}
        {isActive && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "#666" }}>
                {backing.campaign.currentBackingCount.toLocaleString()} / {backing.campaign.moq.toLocaleString()} backers
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>
                {timeUntil(backing.campaign.campaignEnd)}
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: "#f0f0f0",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: progressPct >= 100 ? "#22c55e" : "#0a0a0a",
                  borderRadius: 3,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Shipped — estimated delivery */}
        {(isShipped || isCompleted) && backing.campaign.estimatedShipDate && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 12,
              fontSize: 12,
              color: "#166534",
            }}
          >
            {isCompleted ? "✅ Delivered" : `📦 Est. delivery: ${formatDate(backing.campaign.estimatedShipDate)}`}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 11, color: "#ccc", margin: 0 }}>
            Backed {formatDate(backing.createdAt)}
          </p>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: backingBadge.color,
            }}
          >
            {backingBadge.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
const PAGE_SIZE = 20;

export default function BackingsPage() {
  const [backings, setBackings] = useState<BackingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  // Auth check
  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("loocbooc_token") : null;
    if (!token) {
      setAuthChecked(true);
      setAuthed(false);
      return;
    }
    fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => { setAuthed(true); setAuthChecked(true); })
      .catch(() => { setAuthed(false); setAuthChecked(true); });
  }, []);

  const fetchBackings = useCallback(
    async (nextOffset: number, append = false) => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("loocbooc_token") : null;
      if (!token) return;

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_URL}/api/v1/users/me/backings?limit=${PAGE_SIZE}&offset=${nextOffset}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error("Failed to load backings");
        const json = (await res.json()) as BackingsResponse;
        if (append) {
          setBackings((prev) => [...prev, ...json.data]);
        } else {
          setBackings(json.data);
        }
        setTotal(json.pagination.total);
        setOffset(nextOffset + PAGE_SIZE);
      } catch {
        setError("Couldn't load your backings. Try refreshing.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (authed) void fetchBackings(0);
  }, [authed, fetchBackings]);

  // Filter locally (all backings already fetched, pagination handles volume)
  const filtered = backings.filter((b) => matchesFilter(b, activeFilter));
  const filterCounts: Record<FilterTab, number> = {
    all:           backings.length,
    active:        backings.filter((b) => matchesFilter(b, "active")).length,
    funded:        backings.filter((b) => matchesFilter(b, "funded")).length,
    in_production: backings.filter((b) => matchesFilter(b, "in_production")).length,
    shipped:       backings.filter((b) => matchesFilter(b, "shipped")).length,
    completed:     backings.filter((b) => matchesFilter(b, "completed")).length,
    refunded:      backings.filter((b) => matchesFilter(b, "refunded")).length,
  };

  const hasMore = backings.length < total;

  // ── Not authed ──────────────────────────────────────────────────────────────
  if (authChecked && !authed) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 48, margin: "0 0 16px" }}>🔒</p>
        <h2
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 24,
            fontWeight: 400,
            color: "#0a0a0a",
            margin: "0 0 8px",
          }}
        >
          Sign in to see your backings
        </h2>
        <p style={{ fontSize: 15, color: "#666", margin: "0 0 28px", maxWidth: 320, lineHeight: 1.6 }}>
          Your backing history is waiting for you.
        </p>
        <Link
          href="/login"
          style={{
            background: "#0a0a0a",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading || !authChecked) {
    return (
      <div style={{ padding: "0 16px" }}>
        {/* Header skeleton */}
        <div
          style={{
            padding: "20px 0 16px",
            borderBottom: "1px solid #f0f0f0",
            marginBottom: 20,
          }}
        >
          <div
            style={{ height: 24, width: 140, background: "#f0f0f0", borderRadius: 6, marginBottom: 6 }}
          />
          <div style={{ height: 14, width: 80, background: "#f5f5f5", borderRadius: 4 }} />
        </div>

        {/* Card skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 16,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            <div style={{ height: 120, background: "#f5f5f5" }} />
            <div style={{ padding: 16 }}>
              <div style={{ height: 12, width: 80, background: "#f0f0f0", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 18, width: "75%", background: "#f0f0f0", borderRadius: 4, marginBottom: 16 }} />
              <div style={{ height: 48, background: "#f5f5f5", borderRadius: 8, marginBottom: 12 }} />
              <div style={{ height: 14, width: "50%", background: "#f5f5f5", borderRadius: 4 }} />
            </div>
          </div>
        ))}

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 24px" }}>
      {/* Page header */}
      <div
        style={{
          padding: "20px 0 16px",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 0,
        }}
      >
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 24,
            fontWeight: 400,
            color: "#0a0a0a",
            margin: "0 0 4px",
          }}
        >
          My Backings
        </h1>
        <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
          {total === 0
            ? "Nothing here yet"
            : `${total} campaign${total === 1 ? "" : "s"} backed`}
        </p>
      </div>

      {/* Filter tabs */}
      {total > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "14px 0 12px",
            scrollbarWidth: "none",
          }}
        >
          {FILTER_TABS.map((tab) => {
            const count = filterCounts[tab.id];
            if (count === 0 && tab.id !== "all") return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor: activeFilter === tab.id ? "#0a0a0a" : "#e5e5e5",
                  background: activeFilter === tab.id ? "#0a0a0a" : "#fff",
                  color: activeFilter === tab.id ? "#fff" : "#555",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    style={{
                      marginLeft: 5,
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
            fontSize: 14,
            color: "#991b1b",
            marginTop: 12,
          }}
        >
          {error}
          <button
            onClick={() => void fetchBackings(0)}
            style={{
              marginLeft: 12,
              fontSize: 13,
              color: "#dc2626",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && total === 0 && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 24px",
          }}
        >
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>🚀</p>
          <h3
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 22,
              fontWeight: 400,
              color: "#0a0a0a",
              margin: "0 0 8px",
            }}
          >
            Nothing backed yet
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "#888",
              lineHeight: 1.6,
              maxWidth: 280,
              margin: "0 auto 24px",
            }}
          >
            Browse campaigns and be first to back the styles you want to see made.
          </p>
          <Link
            href="/explore"
            style={{
              display: "inline-block",
              background: "#0a0a0a",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Explore Campaigns
          </Link>
        </div>
      )}

      {/* Filtered empty state */}
      {!loading && total > 0 && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#aaa" }}>
          <p style={{ fontSize: 32, margin: "0 0 12px" }}>🔍</p>
          <p style={{ fontSize: 14 }}>No backings in this category yet.</p>
        </div>
      )}

      {/* Backing cards */}
      {filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
          {filtered.map((backing) => (
            <BackingCard key={backing.id} backing={backing} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && backings.length === filtered.length && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={() => void fetchBackings(offset, true)}
            disabled={loadingMore}
            style={{
              padding: "12px 28px",
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              background: "#fff",
              color: "#0a0a0a",
              fontSize: 14,
              fontWeight: 500,
              cursor: loadingMore ? "not-allowed" : "pointer",
              opacity: loadingMore ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
