"use client";

/**
 * Brief detail — consumer view.
 *
 * Shows:
 * - Brief summary (occasion, budget, style notes, status)
 * - Assigned stylist card (when assigned)
 * - Lookbook view when delivered — product grid, notes, accept CTA
 * - Timeline of status changes
 * - Actions: close brief, rate stylist (after accepted)
 *
 * API:
 *   GET  /api/v1/briefs/:id
 *   POST /api/v1/briefs/:id/accept      — accept delivered lookbook
 *   POST /api/v1/stylists/:id/rate      — rate stylist (after brief accepted)
 *   DELETE /api/v1/briefs/:id           — close brief
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BriefStatus = "open" | "assigned" | "in_progress" | "delivered" | "accepted" | "closed";
type LookbookStatus = "draft" | "published" | "accepted" | "closed";

interface StylistSummary {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  specialisations: string[];
  pricePerBriefCents: number;
  commissionPercent: number;
  verified: boolean;
  instagramHandle: string | null;
  avgRating: number | null;
  ratingCount: number;
}

interface LookbookItem {
  id: string;
  productName: string;
  brandName: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  externalUrl: string | null;
  campaignId: string | null;
  skuId: string | null;
  stylistNote: string | null;
  sortOrder: number;
  purchasedAt: string | null;
}

interface Lookbook {
  id: string;
  briefId: string;
  stylistId: string;
  title: string | null;
  notes: string | null;
  status: LookbookStatus;
  publishedAt: string | null;
  acceptedAt: string | null;
  items: LookbookItem[];
  totalItems: number;
  totalValueCents: number;
  purchasedCount: number;
}

interface BriefDetail {
  id: string;
  title: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  occasion: string[];
  styleNotes: string | null;
  brandPreferences: string[];
  excludedBrands: string[];
  status: BriefStatus;
  stylistId: string | null;
  assignedAt: string | null;
  deadline: string | null;
  hasLookbook: boolean;
  createdAt: string;
  updatedAt: string;
  stylist?: StylistSummary | null;
  lookbook?: Lookbook | null;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_META: Record<BriefStatus, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  open:        { label: "Open",             color: "#92400e", bg: "#fffbeb", icon: "⏳", desc: "Waiting for a stylist to pick this up." },
  assigned:    { label: "Assigned",         color: "#1d4ed8", bg: "#eff6ff", icon: "✂️",  desc: "A stylist has been assigned and will start soon." },
  in_progress: { label: "In progress",      color: "#1d4ed8", bg: "#eff6ff", icon: "🎨", desc: "Your stylist is building your lookbook." },
  delivered:   { label: "Lookbook ready!",  color: "#065f46", bg: "#f0fdf4", icon: "🎉", desc: "Your lookbook is ready. Review it below!" },
  accepted:    { label: "Accepted",         color: "#374151", bg: "#f9fafb", icon: "✅", desc: "You accepted this lookbook." },
  closed:      { label: "Closed",           color: "#6b7280", bg: "#f9fafb", icon: "📁", desc: "This brief is closed." },
};

// ─────────────────────────────────────────────
// Star rating input
// ─────────────────────────────────────────────

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 28,
            color: n <= (hover || value) ? "#f59e0b" : "#d1d5db",
            transition: "color 0.1s",
            padding: "0 2px",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Lookbook item card
// ─────────────────────────────────────────────

function LookbookItemCard({ item, currency }: { item: LookbookItem; currency: string }) {
  return (
    <div style={{
      border: "1.5px solid #e5e5e5",
      borderRadius: 14,
      overflow: "hidden",
      background: "#fff",
      position: "relative",
    }}>
      {/* Image */}
      <div style={{
        width: "100%",
        paddingBottom: "125%",
        background: item.imageUrl ? "transparent" : "#f8f8f8",
        position: "relative",
        overflow: "hidden",
      }}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.productName}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            color: "#ccc",
          }}>
            👗
          </div>
        )}
        {item.purchasedAt && (
          <div style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "#16a34a",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 20,
          }}>
            PURCHASED
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.3 }}>
          {item.productName}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{item.brandName}</div>
        {item.priceCents && (
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0a0a0a" }}>
            {formatCents(item.priceCents, currency)}
          </div>
        )}
        {item.stylistNote && (
          <div style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "#f8f8f8",
            borderRadius: 8,
            fontSize: 12,
            color: "#555",
            fontStyle: "italic",
          }}>
            "{item.stylistNote}"
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          {item.campaignId && (
            <Link
              href={`/back/${item.campaignId}`}
              style={{
                flex: 1,
                padding: "8px 0",
                background: "#0a0a0a",
                color: "#fff",
                borderRadius: 8,
                textAlign: "center",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Back It
            </Link>
          )}
          {item.externalUrl && (
            <a
              href={item.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "8px 0",
                background: "transparent",
                color: "#0a0a0a",
                border: "1.5px solid #0a0a0a",
                borderRadius: 8,
                textAlign: "center",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              View →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stylist card
// ─────────────────────────────────────────────

function StylistCard({ stylist }: { stylist: StylistSummary }) {
  return (
    <div style={{
      padding: "16px",
      border: "1.5px solid #e5e5e5",
      borderRadius: 14,
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#f0f0f0",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          overflow: "hidden",
        }}>
          {stylist.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stylist.avatarUrl} alt={stylist.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : "✂️"}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{stylist.displayName}</span>
            {stylist.verified && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
                padding: "2px 7px",
                borderRadius: 20,
              }}>
                VERIFIED
              </span>
            )}
          </div>

          {stylist.avgRating !== null && (
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
              {"★".repeat(Math.round(stylist.avgRating))}{"☆".repeat(5 - Math.round(stylist.avgRating))}{" "}
              <span style={{ fontWeight: 600 }}>{stylist.avgRating.toFixed(1)}</span>
              <span style={{ color: "#aaa" }}> ({stylist.ratingCount})</span>
            </div>
          )}

          {stylist.bio && (
            <p style={{ fontSize: 13, color: "#666", margin: "6px 0 0", lineHeight: 1.5 }}>
              {stylist.bio.slice(0, 100)}{stylist.bio.length > 100 ? "…" : ""}
            </p>
          )}
        </div>
      </div>

      <Link
        href={`/stylists/${stylist.slug}`}
        style={{
          display: "block",
          marginTop: 12,
          padding: "9px 0",
          border: "1.5px solid #0a0a0a",
          borderRadius: 8,
          textAlign: "center",
          textDecoration: "none",
          color: "#0a0a0a",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        View profile
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Rate stylist modal
// ─────────────────────────────────────────────

function RateModal({
  stylist,
  onClose,
  onSubmit,
}: {
  stylist: StylistSummary;
  onClose: () => void;
  onSubmit: (rating: number, review: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(rating, review);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "flex-end",
      zIndex: 100,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "24px 24px 0 0",
        padding: "32px 24px 40px",
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
      }}>
        {done ? (
          <div style={{ textAlign: "center", paddingBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Thanks for the feedback!</div>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>Your review helps other clients find great stylists.</p>
            <button
              onClick={onClose}
              style={{ padding: "12px 32px", background: "#0a0a0a", color: "#fff", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Rate {stylist.displayName}</div>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>How was your experience?</p>
            <StarRatingInput value={rating} onChange={setRating} />
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Leave an optional review…"
              rows={4}
              style={{
                width: "100%",
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1.5px solid #e5e5e5",
                fontSize: 14,
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "12px 0", background: "transparent", border: "1.5px solid #e5e5e5", borderRadius: 10, fontSize: 14, cursor: "pointer" }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ flex: 2, padding: "12px 0", background: submitting ? "#888" : "#0a0a0a", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function BriefDetailPage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params.id as string;

  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadBrief = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/briefs/${briefId}`, { credentials: "include" });
      if (res.status === 401) { window.location.href = `/auth/login?redirect=/briefs/${briefId}`; return; }
      if (res.status === 404) { setError("Brief not found."); return; }
      if (!res.ok) throw new Error("Failed to load brief");
      const data = await res.json() as { brief: BriefDetail };
      setBrief(data.brief);
    } catch {
      setError("Something went wrong. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [briefId]);

  useEffect(() => { loadBrief(); }, [loadBrief]);

  async function handleAccept() {
    if (!brief) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/v1/briefs/${briefId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to accept");
      showToast("Lookbook accepted! Your stylist has been notified.");
      await loadBrief();
      if (brief.stylist) setShowRateModal(true);
    } catch {
      showToast("Failed to accept. Please try again.", "error");
    } finally {
      setAccepting(false);
    }
  }

  async function handleClose() {
    if (!window.confirm("Close this brief? This can't be undone.")) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/v1/briefs/${briefId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to close");
      showToast("Brief closed.");
      router.push("/briefs");
    } catch {
      showToast("Failed to close brief.", "error");
    } finally {
      setClosing(false);
    }
  }

  async function handleRate(rating: number, review: string) {
    if (!brief?.stylist) return;
    await fetch(`/api/v1/stylists/${brief.stylist.id}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rating, review: review || null }),
    });
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888" }}>Loading brief…</div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#dc2626" }}>{error ?? "Brief not found."}</p>
        <Link href="/briefs" style={{ color: "#555", textDecoration: "underline", fontSize: 14 }}>← Back to briefs</Link>
      </div>
    );
  }

  const meta = STATUS_META[brief.status];
  const lookbook = brief.lookbook;
  const canAccept = brief.status === "delivered" && lookbook?.status === "published";
  const canClose = ["open", "assigned", "in_progress"].includes(brief.status);
  const canRate = brief.status === "accepted" && !!brief.stylist;

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.type === "success" ? "#0a0a0a" : "#dc2626",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 200,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid #f0f0f0",
      }}>
        <Link href="/briefs" style={{ textDecoration: "none", color: "#555", fontSize: 20, lineHeight: 1 }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {brief.title ?? brief.occasion.join(", ") ?? "Style brief"}
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>Created {formatDate(brief.createdAt)}</div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 80px", maxWidth: 600, margin: "0 auto" }}>

        {/* Status banner */}
        <div style={{
          padding: "14px 16px",
          background: meta.bg,
          border: `1px solid ${meta.color}30`,
          borderRadius: 12,
          marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: meta.color, marginBottom: 2 }}>
            {meta.icon} {meta.label}
          </div>
          <div style={{ fontSize: 13, color: meta.color + "cc" }}>{meta.desc}</div>
        </div>

        {/* Brief summary */}
        <div style={{ padding: "16px", border: "1.5px solid #e5e5e5", borderRadius: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Brief details</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginBottom: 2, textTransform: "uppercase" }}>Budget</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {brief.budgetMinCents && brief.budgetMaxCents
                  ? `${formatCents(brief.budgetMinCents)} – ${formatCents(brief.budgetMaxCents)}`
                  : brief.budgetMinCents
                    ? `${formatCents(brief.budgetMinCents)}+`
                    : "Open"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginBottom: 2, textTransform: "uppercase" }}>Deadline</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {brief.deadline ? formatDate(brief.deadline) : "No deadline"}
              </div>
            </div>
          </div>

          {brief.occasion.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Occasion</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {brief.occasion.map((occ) => (
                  <span key={occ} style={{
                    padding: "4px 12px",
                    background: "#f4f4f5",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                  }}>{occ}</span>
                ))}
              </div>
            </div>
          )}

          {brief.styleNotes && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Style notes</div>
              <p style={{ fontSize: 14, color: "#333", margin: 0, lineHeight: 1.6 }}>{brief.styleNotes}</p>
            </div>
          )}

          {brief.brandPreferences.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Preferred brands</div>
              <div style={{ fontSize: 13, color: "#555" }}>{brief.brandPreferences.join(", ")}</div>
            </div>
          )}

          {brief.excludedBrands.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Exclude</div>
              <div style={{ fontSize: 13, color: "#dc2626" }}>{brief.excludedBrands.join(", ")}</div>
            </div>
          )}
        </div>

        {/* Assigned stylist */}
        {brief.stylist && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Your stylist</div>
            <StylistCard stylist={brief.stylist} />
          </div>
        )}

        {/* Lookbook */}
        {lookbook && lookbook.status !== "draft" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>
                {lookbook.title ?? "Your lookbook"}
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {lookbook.totalItems} item{lookbook.totalItems !== 1 ? "s" : ""}
                {lookbook.totalValueCents > 0 && ` · ${formatCents(lookbook.totalValueCents, brief.currency)} total`}
              </div>
            </div>

            {lookbook.notes && (
              <div style={{
                padding: "12px 14px",
                background: "#f8f8f8",
                borderRadius: 10,
                fontSize: 14,
                color: "#444",
                marginBottom: 16,
                lineHeight: 1.6,
                fontStyle: "italic",
              }}>
                "{lookbook.notes}"
              </div>
            )}

            {/* Items grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 14,
            }}>
              {lookbook.items
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => (
                  <LookbookItemCard key={item.id} item={item} currency={brief.currency} />
                ))}
            </div>

            {/* Accept CTA */}
            {canAccept && (
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: accepting ? "#888" : "#0a0a0a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: accepting ? "not-allowed" : "pointer",
                    letterSpacing: "0.01em",
                  }}
                >
                  {accepting ? "Accepting…" : "Accept lookbook"}
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 8 }}>
                  Accepting tells your stylist you love it and tracks commission on purchases.
                </p>
              </div>
            )}

            {/* Accepted + purchase summary */}
            {lookbook.status === "accepted" && lookbook.purchasedCount > 0 && (
              <div style={{
                marginTop: 16,
                padding: "14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                fontSize: 14,
                color: "#065f46",
              }}>
                ✅ You've purchased {lookbook.purchasedCount} item{lookbook.purchasedCount !== 1 ? "s" : ""} from this lookbook.
              </div>
            )}
          </div>
        )}

        {/* Rate stylist CTA */}
        {canRate && (
          <div style={{
            padding: "16px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 12,
            marginBottom: 20,
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>⭐ Rate your stylist</div>
            <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 12px" }}>
              Your review helps other clients find great stylists.
            </p>
            <button
              onClick={() => setShowRateModal(true)}
              style={{
                padding: "10px 24px",
                background: "#0a0a0a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Leave a review
            </button>
          </div>
        )}

        {/* Close brief */}
        {canClose && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <button
              onClick={handleClose}
              disabled={closing}
              style={{
                background: "none",
                border: "none",
                color: closing ? "#aaa" : "#dc2626",
                fontSize: 13,
                cursor: closing ? "not-allowed" : "pointer",
                textDecoration: "underline",
              }}
            >
              {closing ? "Closing…" : "Close brief"}
            </button>
          </div>
        )}
      </div>

      {/* Rate modal */}
      {showRateModal && brief.stylist && (
        <RateModal
          stylist={brief.stylist}
          onClose={() => setShowRateModal(false)}
          onSubmit={handleRate}
        />
      )}
    </div>
  );
}
