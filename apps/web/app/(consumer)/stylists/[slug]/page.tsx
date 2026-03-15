"use client";

/**
 * Stylist Profile page.
 *
 * Full stylist profile with:
 * - Hero section (avatar, name, location, stats)
 * - Bio and specialisations
 * - Portfolio grid (images, captions)
 * - Style keywords
 * - Rating breakdown
 * - Commission and pricing
 * - "Submit a brief" CTA (links to /briefs/new?stylistId=xxx)
 * - Availability status
 *
 * API: GET /api/v1/stylists/:slug
 */

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PortfolioItem {
  id: string;
  imageUrl: string;
  caption: string | null;
  occasion: string | null;
  sortOrder: number;
}

interface StylistFull {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  specialisations: string[];
  styleKeywords: string[];
  pricePerBriefCents: number;
  commissionPercent: number;
  verified: boolean;
  isAvailable: boolean;
  instagramHandle: string | null;
  websiteUrl: string | null;
  completedBriefs: number;
  avgRating: number | null;
  ratingCount: number;
  portfolioItems: PortfolioItem[];
  createdAt: string;
}

// ─────────────────────────────────────────────
// Star rating component
// ─────────────────────────────────────────────

function StarRating({ rating, count, size = 16 }: { rating: number | null; count: number; size?: number }) {
  if (!rating) {
    return <span style={{ fontSize: 13, color: "#aaa" }}>No reviews yet</span>;
  }
  const stars = Math.round(rating);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: size }}>
        {"★".repeat(stars)}{"☆".repeat(5 - stars)}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{rating.toFixed(1)}</span>
      <span style={{ fontSize: 13, color: "#888" }}>({count} review{count !== 1 ? "s" : ""})</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Portfolio lightbox
// ─────────────────────────────────────────────

function PortfolioLightbox({
  items,
  selectedIndex,
  onClose,
  onNavigate,
}: {
  items: PortfolioItem[];
  selectedIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const item = items[selectedIndex];
  if (!item) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "#fff",
          width: 40,
          height: 40,
          borderRadius: "50%",
          fontSize: 18,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ✕
      </button>

      {/* Image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <img
          src={item.imageUrl}
          alt={item.caption ?? "Portfolio item"}
          style={{
            width: "100%",
            maxHeight: "65vh",
            objectFit: "contain",
            borderRadius: 12,
          }}
        />
        {(item.caption || item.occasion) && (
          <div style={{ color: "#fff", textAlign: "center" }}>
            {item.caption && <div style={{ fontSize: 15, fontWeight: 500 }}>{item.caption}</div>}
            {item.occasion && <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Occasion: {item.occasion}</div>}
          </div>
        )}

        {/* Navigation */}
        {items.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(Math.max(0, selectedIndex - 1)); }}
              disabled={selectedIndex === 0}
              style={{
                padding: "8px 20px",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                cursor: selectedIndex === 0 ? "not-allowed" : "pointer",
                opacity: selectedIndex === 0 ? 0.4 : 1,
                fontSize: 14,
              }}
            >
              ← Prev
            </button>
            <span style={{ color: "#888", lineHeight: "36px", fontSize: 13 }}>
              {selectedIndex + 1} / {items.length}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(Math.min(items.length - 1, selectedIndex + 1)); }}
              disabled={selectedIndex === items.length - 1}
              style={{
                padding: "8px 20px",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                cursor: selectedIndex === items.length - 1 ? "not-allowed" : "pointer",
                opacity: selectedIndex === items.length - 1 ? 0.4 : 1,
                fontSize: 14,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function StylistProfilePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [stylist, setStylist] = useState<StylistFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/stylists/${params.slug}`, { credentials: "include" });
        if (res.status === 404) { router.push("/stylists"); return; }
        if (!res.ok) throw new Error("Failed to load stylist profile");
        const data = await res.json() as { stylist: StylistFull };
        setStylist(data.stylist);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888" }}>Loading...</div>
      </div>
    );
  }

  if (error || !stylist) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#dc2626" }}>{error ?? "Stylist not found"}</p>
        <Link href="/stylists">← All stylists</Link>
      </div>
    );
  }

  const freeToStyler = stylist.pricePerBriefCents === 0;

  return (
    <>
      {/* Portfolio lightbox */}
      {lightboxIndex !== null && (
        <PortfolioLightbox
          items={stylist.portfolioItems}
          selectedIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      <div style={{ background: "#fff", minHeight: "100dvh" }}>
        {/* Back button */}
        <div style={{ padding: "16px 20px", maxWidth: 700, margin: "0 auto" }}>
          <button
            onClick={() => router.push("/stylists")}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: 0 }}
          >
            ←
          </button>
        </div>

        <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 20px 60px" }}>
          {/* Hero */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: stylist.avatarUrl ? `url(${stylist.avatarUrl}) center/cover` : "#0a0a0a",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 28,
              }}
            >
              {!stylist.avatarUrl && stylist.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{stylist.displayName}</h1>
                {stylist.verified && (
                  <span style={{
                    fontSize: 12,
                    background: "#0a0a0a",
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontWeight: 600,
                  }}>
                    ✓ Verified
                  </span>
                )}
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: stylist.isAvailable ? "#22c55e" : "#e5e5e5",
                  display: "inline-block",
                  flexShrink: 0,
                }}
                  title={stylist.isAvailable ? "Available now" : "Currently unavailable"}
                />
              </div>
              {stylist.location && (
                <div style={{ fontSize: 14, color: "#888", marginBottom: 6 }}>📍 {stylist.location}</div>
              )}
              <StarRating rating={stylist.avgRating} count={stylist.ratingCount} size={16} />
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                {stylist.completedBriefs} brief{stylist.completedBriefs !== 1 ? "s" : ""} completed
              </div>
            </div>
          </div>

          {/* Availability banner */}
          {!stylist.isAvailable && (
            <div style={{
              padding: "12px 16px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 10,
              fontSize: 13,
              color: "#92400e",
              marginBottom: 20,
            }}>
              ⚠️ This stylist is not accepting new briefs at the moment.
            </div>
          )}

          {/* Bio */}
          {stylist.bio && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 15, color: "#444", lineHeight: 1.7, margin: 0 }}>{stylist.bio}</p>
            </div>
          )}

          {/* Specialisations */}
          {stylist.specialisations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Specialisations
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {stylist.specialisations.map((spec) => (
                  <span key={spec} style={{
                    padding: "6px 14px",
                    background: "#f0f0f0",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}>
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Style keywords */}
          {stylist.styleKeywords.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Style keywords
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {stylist.styleKeywords.map((kw) => (
                  <span key={kw} style={{
                    padding: "4px 12px",
                    background: "#fff",
                    border: "1.5px solid #e5e5e5",
                    borderRadius: 20,
                    fontSize: 12,
                    color: "#666",
                  }}>
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio */}
          {stylist.portfolioItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                Portfolio ({stylist.portfolioItems.length})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {stylist.portfolioItems.map((item, i) => (
                  <div
                    key={item.id}
                    onClick={() => setLightboxIndex(i)}
                    style={{
                      aspectRatio: "1",
                      background: `url(${item.imageUrl}) center/cover no-repeat`,
                      borderRadius: 10,
                      cursor: "pointer",
                      position: "relative",
                      overflow: "hidden",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {item.caption && (
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)",
                        display: "flex",
                        alignItems: "flex-end",
                        padding: "8px",
                      }}>
                        <span style={{ fontSize: 10, color: "#fff", fontWeight: 500, lineHeight: 1.3 }}>
                          {item.caption}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social links */}
          {(stylist.instagramHandle || stylist.websiteUrl) && (
            <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
              {stylist.instagramHandle && (
                <a
                  href={`https://instagram.com/${stylist.instagramHandle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "9px 16px",
                    background: "#f5f5f5",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#333",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📸 Instagram
                </a>
              )}
              {stylist.websiteUrl && (
                <a
                  href={stylist.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "9px 16px",
                    background: "#f5f5f5",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#333",
                  }}
                >
                  🌐 Website
                </a>
              )}
            </div>
          )}

          {/* Pricing card */}
          <div style={{
            background: "#f8f8f8",
            borderRadius: 16,
            padding: "20px",
            marginBottom: 20,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Pricing & commission</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Brief fee</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {freeToStyler ? "Free" : `$${(stylist.pricePerBriefCents / 100).toFixed(0)}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Commission</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {stylist.commissionPercent}%
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.5 }}>
              Commission is only earned when you purchase items from the lookbook.
              {freeToStyler ? " This stylist charges no upfront fee." : ` Brief fee is paid upfront to secure the stylist's time.`}
            </p>
          </div>

          {/* CTA button */}
          {stylist.isAvailable ? (
            <Link
              href={`/briefs/new?stylistId=${stylist.id}`}
              style={{
                display: "block",
                padding: "16px 24px",
                background: "#0a0a0a",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                textAlign: "center",
                marginBottom: 12,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "0.85"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
            >
              Submit a brief to {stylist.displayName.split(" ")[0]}
            </Link>
          ) : (
            <div style={{
              padding: "16px 24px",
              background: "#f5f5f5",
              color: "#aaa",
              border: "none",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 700,
              textAlign: "center",
              marginBottom: 12,
            }}>
              Not accepting briefs right now
            </div>
          )}

          <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", margin: 0 }}>
            No payment taken until you accept and back items from your lookbook.
          </p>
        </div>
      </div>
    </>
  );
}
