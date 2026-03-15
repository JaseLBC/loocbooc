"use client";

/**
 * Stylist Discovery — browse and search verified stylists.
 *
 * Consumer entry point to the Styling Marketplace.
 * Shows:
 * - Search by name or keyword
 * - Filter by specialisation (workwear, casual, occasion, editorial, etc.)
 * - Stylist cards with portfolio preview, rating, price, availability
 * - "Submit a brief" CTA if no stylists match
 *
 * API: GET /api/v1/stylists?search=&specialisation=&available=true&limit=20&offset=0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
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

interface StylistSummary {
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
  completedBriefs: number;
  avgRating: number | null;
  ratingCount: number;
  portfolioItems: PortfolioItem[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SPECIALISATIONS = [
  "All",
  "Workwear",
  "Casual",
  "Evening & occasion",
  "Editorial",
  "Streetwear",
  "Resort & travel",
  "Minimalist",
  "Bold & colour",
];

// ─────────────────────────────────────────────
// Star rating
// ─────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (!rating) return <span style={{ fontSize: 12, color: "#aaa" }}>No reviews yet</span>;
  const stars = Math.round(rating);
  return (
    <span style={{ fontSize: 13, color: "#555" }}>
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}{" "}
      <span style={{ fontWeight: 600 }}>{rating.toFixed(1)}</span>
      <span style={{ color: "#aaa", marginLeft: 4 }}>({count})</span>
    </span>
  );
}

// ─────────────────────────────────────────────
// Stylist card
// ─────────────────────────────────────────────

function StylistCard({ stylist }: { stylist: StylistSummary }) {
  const portfolio = stylist.portfolioItems.slice(0, 3);
  const freeToStyler = stylist.pricePerBriefCents === 0;

  return (
    <Link
      href={`/stylists/${stylist.slug}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          background: "#fff",
          border: "1.5px solid #e5e5e5",
          borderRadius: 18,
          overflow: "hidden",
          transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Portfolio strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", height: 140 }}>
          {portfolio.length > 0 ? (
            portfolio.map((item, i) => (
              <div
                key={item.id}
                style={{
                  background: `url(${item.imageUrl}) center/cover no-repeat`,
                  borderRight: i < 2 ? "2px solid #fff" : "none",
                }}
              />
            ))
          ) : (
            <div
              style={{
                gridColumn: "1 / -1",
                background: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                color: "#ddd",
              }}
            >
              ✂️
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "16px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: stylist.avatarUrl ? `url(${stylist.avatarUrl}) center/cover` : "#0a0a0a",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                border: "2px solid #fff",
                marginTop: -28,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {!stylist.avatarUrl && stylist.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, paddingTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{stylist.displayName}</span>
                {stylist.verified && (
                  <span
                    title="Verified stylist"
                    style={{
                      fontSize: 12,
                      background: "#0a0a0a",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: 20,
                      fontWeight: 600,
                    }}
                  >
                    ✓ Verified
                  </span>
                )}
              </div>
              {stylist.location && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>📍 {stylist.location}</div>
              )}
            </div>
            {/* Availability */}
            <div
              style={{
                flexShrink: 0,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: stylist.isAvailable ? "#22c55e" : "#e5e5e5",
                marginTop: 6,
              }}
              title={stylist.isAvailable ? "Available now" : "Unavailable"}
            />
          </div>

          {/* Bio */}
          {stylist.bio && (
            <p style={{
              fontSize: 13,
              color: "#555",
              lineHeight: 1.5,
              marginBottom: 10,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}>
              {stylist.bio}
            </p>
          )}

          {/* Specialisations */}
          {stylist.specialisations.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {stylist.specialisations.slice(0, 3).map((spec) => (
                <span key={spec} style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  background: "#f5f5f5",
                  borderRadius: 20,
                  color: "#555",
                  fontWeight: 500,
                  textTransform: "capitalize",
                }}>
                  {spec}
                </span>
              ))}
              {stylist.specialisations.length > 3 && (
                <span style={{ fontSize: 11, color: "#aaa", padding: "3px 6px" }}>
                  +{stylist.specialisations.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Rating + stats */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <StarRating rating={stylist.avgRating} count={stylist.ratingCount} />
            <span style={{ fontSize: 12, color: "#888" }}>
              {stylist.completedBriefs} brief{stylist.completedBriefs !== 1 ? "s" : ""} completed
            </span>
          </div>

          {/* Price row */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 12,
            borderTop: "1px solid #f0f0f0",
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0a0a0a" }}>
                {freeToStyler ? "Free styling" : `$${(stylist.pricePerBriefCents / 100).toFixed(0)} per brief`}
              </div>
              <div style={{ fontSize: 11, color: "#aaa" }}>
                {stylist.commissionPercent}% commission on purchases
              </div>
            </div>
            <div style={{
              padding: "8px 16px",
              background: stylist.isAvailable ? "#0a0a0a" : "#f5f5f5",
              color: stylist.isAvailable ? "#fff" : "#aaa",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {stylist.isAvailable ? "Submit brief" : "Unavailable"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #f0f0f0",
      borderRadius: 18,
      overflow: "hidden",
    }}>
      <div style={{ height: 140, background: "#f5f5f5" }} />
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0f0f0" }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 16, width: "60%", background: "#f0f0f0", borderRadius: 4, marginBottom: 6 }} />
            <div style={{ height: 12, width: "40%", background: "#f5f5f5", borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ height: 12, background: "#f5f5f5", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 12, width: "70%", background: "#f5f5f5", borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ onReset, hasFilters }: { onReset: () => void; hasFilters: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>✂️</div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#0a0a0a" }}>
        {hasFilters ? "No stylists match your search" : "No stylists available right now"}
      </h3>
      <p style={{ color: "#666", fontSize: 14, maxWidth: 280, margin: "0 auto 24px", lineHeight: 1.5 }}>
        {hasFilters
          ? "Try broadening your search or removing filters."
          : "More stylists are being onboarded. Submit a brief and we'll match you when one's available."}
      </p>
      {hasFilters ? (
        <button
          onClick={onReset}
          style={{
            padding: "11px 28px",
            background: "#0a0a0a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/briefs/new"
          style={{
            display: "inline-block",
            padding: "11px 28px",
            background: "#0a0a0a",
            color: "#fff",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Submit a brief
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function StylistsPage() {
  const [stylists, setStylists] = useState<StylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [specialisation, setSpecialisation] = useState("All");
  const [availableOnly, setAvailableOnly] = useState(true);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  const fetchStylists = useCallback(async (params: {
    search: string;
    specialisation: string;
    availableOnly: boolean;
    offset: number;
    append: boolean;
  }) => {
    if (params.append) setLoadingMore(true);
    else { setLoading(true); setError(null); }

    try {
      const query = new URLSearchParams({
        limit: "18",
        offset: String(params.offset),
      });
      if (params.search) query.set("search", params.search);
      if (params.specialisation !== "All") query.set("specialisation", params.specialisation);
      if (params.availableOnly) query.set("available", "true");

      const res = await fetch(`/api/v1/stylists?${query.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load stylists (${res.status})`);
      const data = await res.json() as { stylists: StylistSummary[]; total: number; hasMore: boolean };

      if (params.append) setStylists((prev) => [...prev, ...data.stylists]);
      else setStylists(data.stylists);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stylists");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchStylists({
      search: debouncedSearch,
      specialisation,
      availableOnly,
      offset: 0,
      append: false,
    });
    setOffset(0);
  }, [debouncedSearch, specialisation, availableOnly, fetchStylists]);

  const handleLoadMore = () => {
    const newOffset = offset + 18;
    setOffset(newOffset);
    void fetchStylists({
      search: debouncedSearch,
      specialisation,
      availableOnly,
      offset: newOffset,
      append: true,
    });
  };

  const handleReset = () => {
    setSearch("");
    setDebouncedSearch("");
    setSpecialisation("All");
    setAvailableOnly(true);
    setOffset(0);
  };

  const hasFilters = search !== "" || specialisation !== "All" || !availableOnly;

  return (
    <div style={{ background: "#fff", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 0",
        maxWidth: 900,
        margin: "0 auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              Find a stylist
            </h1>
            <p style={{ fontSize: 14, color: "#666" }}>
              Verified stylists who understand your taste, budget, and wardrobe goals.
            </p>
          </div>
          <Link
            href="/briefs/new"
            style={{
              flexShrink: 0,
              padding: "10px 18px",
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

        {/* Search */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          border: "1.5px solid #e5e5e5",
          borderRadius: 12,
          marginBottom: 14,
          background: "#fff",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search by name, specialisation, or style keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 16 }}>
              ✕
            </button>
          )}
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          {/* Specialisation pills */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", flexWrap: "nowrap", scrollbarWidth: "none" }}>
            {SPECIALISATIONS.map((spec) => (
              <button
                key={spec}
                onClick={() => setSpecialisation(spec)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${specialisation === spec ? "#0a0a0a" : "#e5e5e5"}`,
                  background: specialisation === spec ? "#0a0a0a" : "#fff",
                  color: specialisation === spec ? "#fff" : "#555",
                  fontSize: 13,
                  fontWeight: specialisation === spec ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Available only toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
            <div
              onClick={() => setAvailableOnly(!availableOnly)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 12,
                background: availableOnly ? "#0a0a0a" : "#e5e5e5",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute",
                top: 2,
                left: availableOnly ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </div>
            <span style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>Available now</span>
          </label>
        </div>

        {/* Count */}
        {!loading && (
          <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
            {total.toLocaleString()} stylist{total !== 1 ? "s" : ""}
            {total > 0 && ` · ${stylists.filter((s) => s.isAvailable).length} available`}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: "0 20px 20px", padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      <div style={{ padding: "0 20px 40px", maxWidth: 900, margin: "0 auto" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : stylists.length === 0 ? (
          <EmptyState onReset={handleReset} hasFilters={hasFilters} />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
              {stylists.map((stylist) => <StylistCard key={stylist.id} stylist={stylist} />)}
            </div>

            {hasMore && (
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: "12px 32px",
                    background: loadingMore ? "#f0f0f0" : "#fff",
                    border: "1.5px solid #e5e5e5",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#555",
                    cursor: loadingMore ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingMore ? "Loading..." : `Load more (${total - stylists.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* How it works strip */}
      <div style={{
        background: "#f8f8f8",
        padding: "32px 20px",
        marginTop: 8,
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 28 }}>
            How Styling works
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
            {[
              { icon: "📝", title: "Submit a brief", desc: "Tell your stylist your budget, occasion, and what you're after." },
              { icon: "✂️", title: "Stylist picks styles", desc: "They build a personalised lookbook from back-able campaigns and products." },
              { icon: "❤️", title: "You accept & back", desc: "Review the lookbook and back the styles that speak to you." },
              { icon: "💰", title: "Stylist earns commission", desc: "When you purchase, your stylist earns a commission automatically." },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
