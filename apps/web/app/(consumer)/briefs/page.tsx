"use client";

/**
 * My Briefs — consumer brief management dashboard.
 *
 * Shows all of the consumer's style briefs:
 * - Open: submitted, waiting for a stylist to accept
 * - Assigned / in_progress: stylist is working on it
 * - Delivered: lookbook is ready to review
 * - Accepted / closed: completed briefs
 *
 * Each brief card links to /briefs/[id] for the detail/lookbook view.
 *
 * API: GET /api/v1/briefs
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BriefStatus = "open" | "assigned" | "in_progress" | "delivered" | "accepted" | "closed";

interface BriefSummary {
  id: string;
  title: string | null;
  occasion: string[];
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  status: BriefStatus;
  stylistId: string | null;
  hasLookbook: boolean;
  createdAt: string;
  updatedAt: string;
  stylist?: {
    id: string;
    displayName: string;
    slug: string;
    avatarUrl: string | null;
  } | null;
}

// ─────────────────────────────────────────────
// Status metadata
// ─────────────────────────────────────────────

const STATUS_META: Record<BriefStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  open:        { label: "Waiting for stylist", color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "⏳" },
  assigned:    { label: "Stylist assigned",     color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", icon: "✂️" },
  in_progress: { label: "In progress",          color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", icon: "🎨" },
  delivered:   { label: "Lookbook ready!",      color: "#065f46", bg: "#f0fdf4", border: "#bbf7d0", icon: "🎉" },
  accepted:    { label: "Accepted",             color: "#374151", bg: "#f9fafb", border: "#e5e7eb", icon: "✅" },
  closed:      { label: "Closed",               color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", icon: "📁" },
};

// ─────────────────────────────────────────────
// Brief card
// ─────────────────────────────────────────────

function BriefCard({ brief }: { brief: BriefSummary }) {
  const meta = STATUS_META[brief.status];
  const isDelivered = brief.status === "delivered";

  const budgetText = brief.budgetMinCents && brief.budgetMaxCents
    ? `$${(brief.budgetMinCents / 100).toFixed(0)}–$${(brief.budgetMaxCents / 100).toFixed(0)}`
    : brief.budgetMaxCents
    ? `Up to $${(brief.budgetMaxCents / 100).toFixed(0)}`
    : null;

  const relativeDate = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round((new Date(brief.updatedAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  );

  return (
    <Link
      href={`/briefs/${brief.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          border: `2px solid ${isDelivered ? "#22c55e" : "#e5e5e5"}`,
          borderRadius: 16,
          padding: "18px 20px",
          marginBottom: 12,
          background: isDelivered ? "#f0fdf4" : "#fff",
          transition: "transform 0.15s, box-shadow 0.15s",
          cursor: "pointer",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Status badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 20,
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
          }}>
            {meta.icon} {meta.label}
          </span>
          <span style={{ fontSize: 11, color: "#aaa" }}>{relativeDate}</span>
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          {brief.title ?? (brief.occasion.length > 0
            ? brief.occasion.slice(0, 2).map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(", ")
            : "Style brief"
          )}
        </div>

        {/* Meta row */}
        <div style={{ fontSize: 13, color: "#888", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {brief.occasion.length > 0 && (
            <span>{brief.occasion.slice(0, 3).join(", ")}</span>
          )}
          {budgetText && <span>Budget: {budgetText}</span>}
        </div>

        {/* Stylist */}
        {brief.stylist && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #f0f0f0",
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: brief.stylist.avatarUrl ? `url(${brief.stylist.avatarUrl}) center/cover` : "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {!brief.stylist.avatarUrl && brief.stylist.displayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
              Styled by {brief.stylist.displayName}
            </span>
          </div>
        )}

        {/* Lookbook ready CTA */}
        {isDelivered && (
          <div style={{
            marginTop: 14,
            padding: "10px 16px",
            background: "#0a0a0a",
            color: "#fff",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
          }}>
            View your lookbook →
          </div>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>📋</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>No briefs yet</h2>
      <p style={{ color: "#666", fontSize: 15, maxWidth: 280, margin: "0 auto 32px", lineHeight: 1.5 }}>
        Submit a brief and a stylist will build you a personalised lookbook.
      </p>
      <Link
        href="/briefs/new"
        style={{
          display: "inline-block",
          padding: "14px 32px",
          background: "#0a0a0a",
          color: "#fff",
          borderRadius: 12,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Submit my first brief
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function MyBriefsPage() {
  const router = useRouter();
  const [briefs, setBriefs] = useState<BriefSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/briefs", { credentials: "include" });
        if (res.status === 401) {
          router.push("/auth/login?redirect=/briefs");
          return;
        }
        if (!res.ok) throw new Error("Failed to load briefs");
        const data = await res.json() as { briefs: BriefSummary[] };
        setBriefs(data.briefs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const activeStatuses: BriefStatus[] = ["open", "assigned", "in_progress", "delivered"];
  const completedStatuses: BriefStatus[] = ["accepted", "closed"];

  const filtered = briefs?.filter((b) => {
    if (activeFilter === "active") return activeStatuses.includes(b.status);
    if (activeFilter === "completed") return completedStatuses.includes(b.status);
    return true;
  }) ?? [];

  const activeCount = briefs?.filter((b) => activeStatuses.includes(b.status)).length ?? 0;
  const deliveredCount = briefs?.filter((b) => b.status === "delivered").length ?? 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888" }}>Loading your briefs...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 0",
        maxWidth: 600,
        margin: "0 auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Briefs</h1>
          <Link
            href="/briefs/new"
            style={{
              padding: "9px 16px",
              background: "#0a0a0a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            + New brief
          </Link>
        </div>

        {/* Delivered alert */}
        {deliveredCount > 0 && (
          <div style={{
            marginTop: 14,
            padding: "14px 16px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 12,
            fontSize: 14,
            color: "#065f46",
            fontWeight: 600,
          }}>
            🎉 {deliveredCount} lookbook{deliveredCount > 1 ? "s are" : " is"} ready to review!
          </div>
        )}

        {/* Filter tabs */}
        {briefs && briefs.length > 0 && (
          <div style={{
            display: "flex",
            gap: 0,
            marginTop: 20,
            borderBottom: "1px solid #f0f0f0",
          }}>
            {[
              { value: "all" as const,       label: `All (${briefs.length})` },
              { value: "active" as const,    label: `Active (${activeCount})` },
              { value: "completed" as const, label: `Completed (${briefs.length - activeCount})` },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setActiveFilter(value)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${activeFilter === value ? "#0a0a0a" : "transparent"}`,
                  fontWeight: activeFilter === value ? 700 : 500,
                  fontSize: 13,
                  color: activeFilter === value ? "#0a0a0a" : "#888",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "20px 20px 40px", maxWidth: 600, margin: "0 auto" }}>
        {error && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {!briefs || briefs.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888", fontSize: 14 }}>
            No {activeFilter === "active" ? "active" : "completed"} briefs.
          </div>
        ) : (
          filtered.map((brief) => <BriefCard key={brief.id} brief={brief} />)
        )}

        {/* Bottom CTA */}
        {briefs && briefs.length > 0 && (
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link
              href="/stylists"
              style={{
                fontSize: 14,
                color: "#555",
                textDecoration: "underline",
              }}
            >
              Browse stylists
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
