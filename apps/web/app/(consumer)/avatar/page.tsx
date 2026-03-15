"use client";

/**
 * Avatar dashboard — consumer's avatar management hub.
 *
 * Shows:
 * - All avatars with completion ring and primary badge
 * - Recent fit results
 * - CTA to create new avatar / update measurements
 * - Body shape + fit preference summary
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AvatarSummary {
  id: string;
  nickname: string | null;
  isPrimary: boolean;
  measurementMethod: string | null;
  confidenceScore: number | null;
  confidenceLabel: "high" | "medium" | "low" | "uncalibrated";
  bodyShape: string | null;
  fitPreference: string | null;
  avatarImgUrl: string | null;
  sizeAu: string | null;
  completionPercent: number;
  hasFitHistory: boolean;
  createdAt: string;
}

interface FitResultSummary {
  skuId: string;
  garmentName: string;
  brandName: string;
  recommendedSize: string | null;
  fitScore: number | null;
  fitLabel: "perfect" | "good" | "ok" | "poor" | null;
  renderUrl: string | null;
}

interface AvatarFull extends AvatarSummary {
  fitResults: FitResultSummary[];
}

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────

const BODY_SHAPE_ICONS: Record<string, string> = {
  hourglass: "⌛",
  pear: "🍐",
  apple: "🍎",
  rectangle: "▭",
  inverted_triangle: "▽",
};

const FIT_LABEL_COLORS: Record<string, string> = {
  perfect: "#16a34a",
  good: "#2563eb",
  ok: "#d97706",
  poor: "#dc2626",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#16a34a",
  medium: "#2563eb",
  low: "#d97706",
  uncalibrated: "#9ca3af",
};

// ─────────────────────────────────────────────
// Completion ring SVG
// ─────────────────────────────────────────────

function CompletionRing({ percent, size = 64 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="#0a0a0a"
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Avatar card
// ─────────────────────────────────────────────

function AvatarCard({ avatar, onSetPrimary }: { avatar: AvatarSummary; onSetPrimary: (id: string) => void }) {
  return (
    <div style={{
      border: `2px solid ${avatar.isPrimary ? "#0a0a0a" : "#e5e5e5"}`,
      borderRadius: 16,
      padding: "20px",
      marginBottom: 14,
      background: avatar.isPrimary ? "#fafafa" : "#fff",
      position: "relative",
    }}>
      {avatar.isPrimary && (
        <div style={{
          position: "absolute",
          top: 14,
          right: 14,
          background: "#0a0a0a",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 20,
          letterSpacing: "0.03em",
        }}>
          PRIMARY
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Completion ring with body shape icon */}
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <CompletionRing percent={avatar.completionPercent} />
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}>
            {avatar.bodyShape ? BODY_SHAPE_ICONS[avatar.bodyShape] ?? "◯" : "◯"}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
            {avatar.nickname ?? "My avatar"}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
            {avatar.completionPercent}% complete
            {avatar.bodyShape && ` · ${avatar.bodyShape.replace("_", " ")} shape`}
            {avatar.fitPreference && ` · ${avatar.fitPreference} fit`}
          </div>

          {/* Confidence badge */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 20,
              background: `${CONFIDENCE_COLORS[avatar.confidenceLabel]}20`,
              color: CONFIDENCE_COLORS[avatar.confidenceLabel],
              border: `1px solid ${CONFIDENCE_COLORS[avatar.confidenceLabel]}40`,
            }}>
              {avatar.confidenceLabel === "uncalibrated" ? "No measurements yet" :
               avatar.confidenceLabel === "high" ? "High confidence" :
               avatar.confidenceLabel === "medium" ? "Good confidence" :
               "Low confidence"}
            </span>
            {avatar.hasFitHistory && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 20,
                background: "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #bbf7d0",
              }}>
                Has fit history
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Link
          href={`/avatar/${avatar.id}`}
          style={{
            flex: 1,
            padding: "10px 16px",
            background: "#0a0a0a",
            color: "#fff",
            borderRadius: 8,
            textAlign: "center",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          View & edit
        </Link>
        {!avatar.isPrimary && (
          <button
            onClick={() => onSetPrimary(avatar.id)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 13,
              color: "#555",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Set as primary
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Fit result row
// ─────────────────────────────────────────────

function FitResultRow({ result }: { result: FitResultSummary }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 0",
      borderBottom: "1px solid #f5f5f5",
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{result.garmentName}</div>
        <div style={{ fontSize: 12, color: "#888" }}>{result.brandName}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        {result.recommendedSize && (
          <div style={{ fontWeight: 700, fontSize: 16 }}>Size {result.recommendedSize}</div>
        )}
        {result.fitLabel && (
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: FIT_LABEL_COLORS[result.fitLabel] ?? "#666",
          }}>
            {result.fitLabel.charAt(0).toUpperCase() + result.fitLabel.slice(1)} fit
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>👗</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Create your avatar
      </h2>
      <p style={{ color: "#666", fontSize: 15, marginBottom: 32, maxWidth: 280, margin: "0 auto 32px" }}>
        Add your measurements and we&apos;ll show you the right size for every style — automatically.
      </p>
      <Link
        href="/avatar/create"
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
        Create my avatar
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AvatarDashboardPage() {
  const [avatars, setAvatars] = useState<AvatarSummary[] | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/avatars", { credentials: "include" });
        if (res.status === 401) {
          window.location.href = "/auth/login?redirect=/avatar";
          return;
        }
        if (!res.ok) throw new Error("Failed to load avatars");
        const data = await res.json() as { avatars: AvatarSummary[] };
        setAvatars(data.avatars);

        // Load full primary avatar details
        const primary = data.avatars.find((a) => a.isPrimary) ?? data.avatars[0];
        if (primary) {
          loadAvatarDetail(primary.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function loadAvatarDetail(avatarId: string) {
    try {
      const res = await fetch(`/api/v1/avatars/${avatarId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { avatar: AvatarFull };
      setSelectedAvatar(data.avatar);
    } catch {
      // non-critical
    }
  }

  async function handleSetPrimary(avatarId: string) {
    try {
      await fetch(`/api/v1/avatars/${avatarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPrimary: true }),
      });
      setAvatars((prev) =>
        prev?.map((a) => ({ ...a, isPrimary: a.id === avatarId })) ?? null
      );
    } catch {
      // handle silently
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888", fontSize: 14 }}>Loading your avatar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "#dc2626" }}>Error: {error}</div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 520,
        margin: "0 auto",
      }}>
        <a href="/" style={{ fontSize: 16, fontWeight: 700, textDecoration: "none", color: "#0a0a0a" }}>
          loocbooc
        </a>
        {avatars && avatars.length > 0 && (
          <Link
            href="/avatar/create"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#0a0a0a",
              textDecoration: "none",
              border: "1.5px solid #0a0a0a",
              padding: "6px 14px",
              borderRadius: 20,
            }}
          >
            + New avatar
          </Link>
        )}
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 520, margin: "0 auto" }}>
        {(!avatars || avatars.length === 0) ? (
          <EmptyState />
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>My avatars</h1>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
              Your measurements power fit recommendations on every style.
            </p>

            {/* Avatar cards */}
            {avatars.map((avatar) => (
              <AvatarCard
                key={avatar.id}
                avatar={avatar}
                onSetPrimary={handleSetPrimary}
              />
            ))}

            {/* Fit history for selected avatar */}
            {selectedAvatar && selectedAvatar.fitResults.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>
                  Recent fit recommendations
                </h2>
                {selectedAvatar.fitResults.slice(0, 8).map((result, i) => (
                  <FitResultRow key={`${result.skuId}-${i}`} result={result} />
                ))}
              </div>
            )}

            {/* How it works */}
            <div style={{
              marginTop: 28,
              padding: "20px",
              background: "#f8f8f8",
              borderRadius: 16,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>How fit recommendations work</div>
              {[
                { icon: "📏", text: "Your measurements are matched against each brand's size chart" },
                { icon: "🎯", text: "We score every size and pick the best fit for your body and preference" },
                { icon: "📈", text: "Confidence improves as you add more measurements" },
                { icon: "🔒", text: "Your measurements are private — only you can see them" },
              ].map(({ icon, text }, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 14 }}>
                  <span>{icon}</span>
                  <span style={{ color: "#555" }}>{text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
