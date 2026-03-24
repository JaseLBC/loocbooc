"use client";

/**
 * Stylist briefs — two tabs: open brief feed and my active briefs.
 *
 * OPEN FEED:
 *   Browse all open, unassigned briefs. PII-stripped server-side.
 *   Each brief shows: occasion, budget range, size hint, days old, style notes.
 *   Accept button → transitions brief to assigned.
 *
 * MY BRIEFS:
 *   All briefs assigned to this stylist. Sortable by status and date.
 *   Quick status badge. Link to detail page.
 *
 * API:
 *   GET /api/v1/briefs/feed           — open brief feed (PII-free)
 *   POST /api/v1/briefs/:id/accept-as-stylist — accept a brief
 *   GET /api/v1/briefs/mine           — my stylist briefs
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BriefStatus = "open" | "assigned" | "in_progress" | "delivered" | "accepted" | "closed";

interface BriefFeedItem {
  id: string;
  title: string | null;
  occasion: string[];
  budgetRange: string | null;
  styleNotes: string | null;
  sizeHint: string | null;
  createdAt: string;
  deadline: string | null;
  hasAvatar: boolean;
}

interface MyBriefSummary {
  id: string;
  title: string | null;
  occasion: string[];
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  status: BriefStatus;
  hasLookbook: boolean;
  createdAt: string;
  updatedAt: string;
  consumer?: {
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCents(cents: number | null | undefined, currency = "AUD"): string {
  if (!cents) return "—";
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

const STATUS_META: Record<BriefStatus, { label: string; color: string; bg: string }> = {
  open:        { label: "Open",        color: "#92400e", bg: "#fffbeb" },
  assigned:    { label: "Assigned",    color: "#1d4ed8", bg: "#eff6ff" },
  in_progress: { label: "Working on",  color: "#1d4ed8", bg: "#eff6ff" },
  delivered:   { label: "Delivered",   color: "#065f46", bg: "#f0fdf4" },
  accepted:    { label: "Accepted",    color: "#374151", bg: "#f9fafb" },
  closed:      { label: "Closed",      color: "#6b7280", bg: "#f9fafb" },
};

// ─────────────────────────────────────────────
// Open brief card
// ─────────────────────────────────────────────

function OpenBriefCard({
  brief,
  onAccept,
  accepting,
}: {
  brief: BriefFeedItem;
  onAccept: (id: string) => void;
  accepting: string | null;
}) {
  const isAccepting = accepting === brief.id;
  const daysOld = daysSince(brief.createdAt);

  return (
    <div style={{
      border: "1.5px solid #e5e5e5",
      borderRadius: 14,
      padding: "16px",
      marginBottom: 12,
      background: "#fff",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
            {brief.title ?? brief.occasion.join(", ") ?? "Style brief"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {brief.occasion.slice(0, 3).map((occ) => (
              <span key={occ} style={{
                fontSize: 11,
                padding: "3px 10px",
                background: "#f4f4f5",
                borderRadius: 20,
                color: "#555",
                fontWeight: 500,
              }}>{occ}</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
          {brief.budgetRange && (
            <div style={{ fontSize: 14, fontWeight: 700 }}>{brief.budgetRange}</div>
          )}
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
            {daysOld === 0 ? "Today" : `${daysOld}d ago`}
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {brief.sizeHint && (
          <div style={{ fontSize: 12, color: "#555" }}>
            <span style={{ color: "#aaa" }}>Size:</span> {brief.sizeHint}
          </div>
        )}
        {brief.hasAvatar && (
          <div style={{ fontSize: 12, color: "#555" }}>
            👤 Has body measurements
          </div>
        )}
        {brief.deadline && (
          <div style={{ fontSize: 12, color: "#d97706" }}>
            ⏰ Deadline: {new Date(brief.deadline).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </div>
        )}
      </div>

      {brief.styleNotes && (
        <p style={{
          fontSize: 13,
          color: "#555",
          margin: "0 0 12px",
          lineHeight: 1.5,
          fontStyle: "italic",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          "{brief.styleNotes}"
        </p>
      )}

      <button
        onClick={() => onAccept(brief.id)}
        disabled={!!accepting}
        style={{
          width: "100%",
          padding: "11px 0",
          background: isAccepting ? "#888" : "#0a0a0a",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          cursor: !!accepting ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {isAccepting ? "Accepting…" : "Accept this brief →"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// My brief row
// ─────────────────────────────────────────────

function MyBriefRow({ brief }: { brief: MyBriefSummary }) {
  const meta = STATUS_META[brief.status];
  const daysOld = daysSince(brief.updatedAt);
  const needsAttention = brief.status === "in_progress" && daysOld > 7;

  return (
    <Link
      href={`/stylist/briefs/${brief.id}`}
      style={{ textDecoration: "none" }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 16px",
        borderBottom: "1px solid #f5f5f5",
        cursor: "pointer",
        background: needsAttention ? "#fff9f9" : "transparent",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0a0a0a", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {brief.title ?? brief.occasion.join(", ") ?? "Style brief"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: meta.color,
              background: meta.bg,
              border: `1px solid ${meta.color}30`,
              padding: "2px 8px",
              borderRadius: 20,
            }}>
              {meta.label.toUpperCase()}
            </span>
            {needsAttention && (
              <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>⚠️ Stale</span>
            )}
            {brief.hasLookbook && brief.status === "in_progress" && (
              <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>📝 Lookbook draft</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>
            {brief.budgetMinCents && brief.budgetMaxCents
              ? `${formatCents(brief.budgetMinCents)}–${formatCents(brief.budgetMaxCents)}`
              : "Open"
            }
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
            Updated {daysOld === 0 ? "today" : `${daysOld}d ago`}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

type ActiveTab = "feed" | "mine";

export default function StylistBriefsPage() {
  const [tab, setTab] = useState<ActiveTab>("feed");
  const [feedBriefs, setFeedBriefs] = useState<BriefFeedItem[] | null>(null);
  const [myBriefs, setMyBriefs] = useState<MyBriefSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [myStatusFilter, setMyStatusFilter] = useState<"active" | "all">("active");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/briefs/feed", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { briefs: BriefFeedItem[] };
        setFeedBriefs(data.briefs);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyBriefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/briefs/mine", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { briefs: MyBriefSummary[] };
        setMyBriefs(data.briefs);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "feed" && feedBriefs === null) loadFeed();
    if (tab === "mine" && myBriefs === null) loadMyBriefs();
  }, [tab, feedBriefs, myBriefs, loadFeed, loadMyBriefs]);

  async function handleAccept(briefId: string) {
    setAccepting(briefId);
    try {
      const res = await fetch(`/api/v1/briefs/${briefId}/accept-as-stylist`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Brief accepted! Start work in My Briefs.");
        setFeedBriefs((prev) => prev?.filter((b) => b.id !== briefId) ?? prev);
        setMyBriefs(null); // force reload when switching to mine
        setTab("mine");
      } else {
        const err = await res.json() as { error?: { message?: string } };
        showToast(err.error?.message ?? "Failed to accept brief.");
      }
    } finally {
      setAccepting(null);
    }
  }

  const activeMyBriefs = myBriefs?.filter((b) =>
    myStatusFilter === "active"
      ? !["accepted", "closed"].includes(b.status)
      : true
  ) ?? [];

  const activeBriefCount = myBriefs?.filter((b) => !["accepted", "closed"].includes(b.status)).length ?? 0;

  return (
    <div style={{ minHeight: "100dvh", background: "#fafafa" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#0a0a0a",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 200,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e5e5e5",
        padding: "0 20px",
      }}>
        <h1 style={{ fontWeight: 800, fontSize: 20, margin: "20px 0 16px" }}>Briefs</h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {[
            { id: "feed" as const, label: "Open feed" },
            { id: "mine" as const, label: `My briefs${activeBriefCount > 0 ? ` (${activeBriefCount})` : ""}` },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "12px 20px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === id ? "#0a0a0a" : "transparent"}`,
                fontWeight: tab === id ? 700 : 500,
                fontSize: 14,
                color: tab === id ? "#0a0a0a" : "#888",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 20px 40px", maxWidth: 680, margin: "0 auto" }}>

        {/* Open feed tab */}
        {tab === "feed" && (
          <>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              Open briefs from clients looking for a stylist. Client identity is anonymous until you accept.
            </p>

            {loading && feedBriefs === null ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>Loading feed…</div>
            ) : !feedBriefs || feedBriefs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Feed is empty</div>
                <p style={{ fontSize: 13, color: "#888" }}>
                  No open briefs right now. Check back soon — new briefs come in daily.
                </p>
              </div>
            ) : (
              feedBriefs.map((brief) => (
                <OpenBriefCard
                  key={brief.id}
                  brief={brief}
                  onAccept={handleAccept}
                  accepting={accepting}
                />
              ))
            )}
          </>
        )}

        {/* My briefs tab */}
        {tab === "mine" && (
          <>
            {/* Filter */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid #e5e5e5" }}>
              {[
                { value: "active" as const, label: "Active" },
                { value: "all" as const,    label: "All" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMyStatusFilter(value)}
                  style={{
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${myStatusFilter === value ? "#0a0a0a" : "transparent"}`,
                    fontWeight: myStatusFilter === value ? 700 : 500,
                    fontSize: 13,
                    color: myStatusFilter === value ? "#0a0a0a" : "#888",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading && myBriefs === null ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>Loading…</div>
            ) : activeMyBriefs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
                  {myStatusFilter === "active" ? "No active briefs" : "No briefs yet"}
                </div>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
                  {myStatusFilter === "active"
                    ? "All caught up. Check the open feed for new work."
                    : "Accept your first brief from the open feed."}
                </p>
                <button
                  onClick={() => setTab("feed")}
                  style={{
                    padding: "10px 20px",
                    background: "#0a0a0a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Browse open feed
                </button>
              </div>
            ) : (
              <div style={{ border: "1.5px solid #e5e5e5", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
                {activeMyBriefs.map((brief) => (
                  <MyBriefRow key={brief.id} brief={brief} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
