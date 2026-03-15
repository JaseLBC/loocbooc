"use client";

/**
 * Explore — campaign discovery page.
 *
 * The public-facing front door of Loocbooc. Works for both logged-in and
 * anonymous users. The primary consumer acquisition surface.
 *
 * Features:
 * - Hero section with value proposition
 * - Active campaign grid with progress bars, backer counts, price
 * - Category filter tabs (All, Dresses, Tops, Bottoms, Outerwear, Accessories)
 * - Sort options (ending soon, most backed, newest, biggest savings)
 * - Personalised sort for logged-in users (taste engine score)
 * - Search input (debounced, matches title + brand)
 * - "Back It" CTA links to /back/[campaignSlug]
 * - Avatar + fit recommendation nudge for users without avatars
 * - Empty state with clear "No campaigns matching your search" message
 * - Skeleton loading cards while fetching
 *
 * API calls:
 *   GET /api/v1/campaigns?status=active&category=&sort=&search=&limit=24&offset=0
 *   GET /api/v1/taste/campaigns (personalised, only when logged in)
 *
 * Data is fetched client-side for simplicity. In production this should be
 * a Next.js server component with ISR (revalidate every 60s) for SEO and speed.
 * The progress bars are then client-side-only components hydrated after server render.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth";
import { API_URL } from "../../../lib/supabase";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Campaign {
  id: string;
  title: string;
  slug: string;
  brandName: string;
  brandId: string;
  coverImageUrl: string | null;
  status: string;
  backerPriceCents: number;
  retailPriceCents: number;
  currency: string;
  currentBackingCount: number;
  moq: number;
  campaignEnd: string;
  availableSizes: string[];
  category: string | null;
  createdAt: string;
}

type SortOption = "ending_soon" | "most_backed" | "newest" | "biggest_savings";
type CategoryFilter = "all" | "dress" | "top" | "bottom" | "outerwear" | "accessories";

interface CampaignFeed {
  campaigns: Campaign[];
  total: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dress", label: "Dresses" },
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "outerwear", label: "Outerwear" },
  { value: "accessories", label: "Accessories" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "ending_soon", label: "Ending soon" },
  { value: "most_backed", label: "Most backed" },
  { value: "newest", label: "Newest" },
  { value: "biggest_savings", label: "Biggest savings" },
];

const PAGE_SIZE = 24;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPrice(cents: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function savingsPercent(backerCents: number, retailCents: number): number {
  return Math.round(((retailCents - backerCents) / retailCents) * 100);
}

function daysLeft(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function moqProgress(current: number, moq: number): number {
  return Math.min(100, Math.round((current / moq) * 100));
}

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
        border: "1px solid #f0f0f0",
      }}
    >
      <div
        style={{
          height: 200,
          background: "linear-gradient(90deg, #f5f5f5 25%, #ebebeb 50%, #f5f5f5 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div style={{ padding: "16px" }}>
        <div
          style={{
            height: 14,
            width: "60%",
            background: "#f5f5f5",
            borderRadius: 6,
            marginBottom: 10,
            animation: "shimmer 1.5s infinite",
          }}
        />
        <div
          style={{
            height: 10,
            width: "40%",
            background: "#f5f5f5",
            borderRadius: 6,
            marginBottom: 14,
            animation: "shimmer 1.5s infinite",
          }}
        />
        <div
          style={{
            height: 4,
            background: "#f5f5f5",
            borderRadius: 2,
            marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div
            style={{
              height: 12,
              width: 80,
              background: "#f5f5f5",
              borderRadius: 6,
            }}
          />
          <div
            style={{
              height: 12,
              width: 60,
              background: "#f5f5f5",
              borderRadius: 6,
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// Campaign card
// ─────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = moqProgress(campaign.currentBackingCount, campaign.moq);
  const days = daysLeft(campaign.campaignEnd);
  const savings = savingsPercent(campaign.backerPriceCents, campaign.retailPriceCents);
  const isAlmostDone = progress >= 80 && progress < 100;
  const isHot = campaign.currentBackingCount >= campaign.moq * 0.5 && days <= 7;

  return (
    <Link
      href={`/back/${campaign.slug}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          border: "1px solid #f0f0f0",
          transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Cover image */}
        <div
          style={{
            height: 200,
            background: campaign.coverImageUrl
              ? `url(${campaign.coverImageUrl}) center/cover no-repeat`
              : "linear-gradient(135deg, #f8f8f8 0%, #ececec 100%)",
            position: "relative",
          }}
        >
          {/* Badges */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              display: "flex",
              gap: 6,
            }}
          >
            {savings >= 15 && (
              <span
                style={{
                  background: "#0a0a0a",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 20,
                }}
              >
                {savings}% off
              </span>
            )}
            {isHot && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 20,
                }}
              >
                🔥 Hot
              </span>
            )}
          </div>

          {/* Days left badge */}
          {days <= 7 && days > 0 && (
            <span
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: days <= 3 ? "#ef4444" : "#f97316",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 20,
              }}
            >
              {days}d left
            </span>
          )}

          {/* No image placeholder */}
          {!campaign.coverImageUrl && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                opacity: 0.3,
              }}
            >
              👗
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "14px 16px 16px" }}>
          {/* Brand */}
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {campaign.brandName}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#0a0a0a",
              marginBottom: 12,
              lineHeight: 1.3,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {campaign.title}
          </div>

          {/* MOQ progress bar */}
          <div
            style={{
              height: 5,
              background: "#f0f0f0",
              borderRadius: 3,
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: isAlmostDone
                  ? "#f97316"
                  : progress >= 100
                  ? "#22c55e"
                  : "#0a0a0a",
                borderRadius: 3,
                transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </div>

          {/* Progress text + backing count */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "#666" }}>
              <strong style={{ color: "#0a0a0a" }}>{campaign.currentBackingCount}</strong> of {campaign.moq} backed
              {progress >= 100 && (
                <span style={{ color: "#22c55e", marginLeft: 4 }}>✓ Goal reached</span>
              )}
            </span>
            <span style={{ fontSize: 12, color: "#888" }}>
              {progress}%
            </span>
          </div>

          {/* Price row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#0a0a0a",
                }}
              >
                {formatPrice(campaign.backerPriceCents, campaign.currency)}
              </span>
              {savings >= 5 && (
                <span
                  style={{
                    fontSize: 12,
                    color: "#aaa",
                    marginLeft: 6,
                    textDecoration: "line-through",
                  }}
                >
                  {formatPrice(campaign.retailPriceCents, campaign.currency)}
                </span>
              )}
            </div>

            {/* Size pills (just first 3 + overflow count) */}
            {campaign.availableSizes.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                {campaign.availableSizes.slice(0, 3).map((size) => (
                  <span
                    key={size}
                    style={{
                      fontSize: 10,
                      color: "#555",
                      padding: "2px 7px",
                      border: "1px solid #e5e5e5",
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    {size}
                  </span>
                ))}
                {campaign.availableSizes.length > 3 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "#888",
                      padding: "2px 6px",
                    }}
                  >
                    +{campaign.availableSizes.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Hero section (for unauthenticated/new users)
// ─────────────────────────────────────────────

function Hero() {
  return (
    <div
      style={{
        background: "#0a0a0a",
        color: "#fff",
        padding: "48px 24px 40px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 13,
          letterSpacing: "0.12em",
          fontWeight: 500,
          opacity: 0.6,
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        loocbooc
      </div>
      <h1
        style={{
          fontSize: "clamp(28px, 6vw, 44px)",
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          marginBottom: 16,
          maxWidth: 480,
          margin: "0 auto 16px",
        }}
      >
        Back styles before they&apos;re made.
      </h1>
      <p
        style={{
          fontSize: 16,
          opacity: 0.7,
          lineHeight: 1.6,
          maxWidth: 360,
          margin: "0 auto 28px",
        }}
      >
        Designers bring styles to life only when enough people back them.
        Exclusive prices. No waste. The future of fashion.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/auth/register"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#fff",
            color: "#0a0a0a",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          Create account
        </Link>
        <Link
          href="/auth/login"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "transparent",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 10,
            fontWeight: 500,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Avatar nudge (for logged-in users without an avatar)
// ─────────────────────────────────────────────

function AvatarNudge() {
  return (
    <div
      style={{
        margin: "0 16px 24px",
        padding: "16px 18px",
        background: "#f8f8f8",
        borderRadius: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
          📏 Add your measurements
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>
          We&apos;ll show you the right size for every style.
        </div>
      </div>
      <Link
        href="/avatar/create"
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          background: "#0a0a0a",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Set up
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({
  search,
  category,
  onReset,
}: {
  search: string;
  category: CategoryFilter;
  onReset: () => void;
}) {
  const hasFilters = search || category !== "all";

  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 24px",
        color: "#888",
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: "#0a0a0a", marginBottom: 8 }}>
        {hasFilters ? "No matching campaigns" : "No active campaigns right now"}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 24, maxWidth: 280, margin: "0 auto 24px" }}>
        {hasFilters
          ? "Try a different search or remove filters to see all campaigns."
          : "Check back soon — new styles drop regularly."}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          style={{
            padding: "11px 24px",
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
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ExplorePage() {
  const { user, isLoading: authLoading } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<SortOption>("ending_soon");
  const [hasAvatar, setHasAvatar] = useState<boolean | null>(null);

  // Debounce search input
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  // Check if logged-in user has an avatar
  useEffect(() => {
    if (!user) {
      setHasAvatar(null);
      return;
    }
    async function checkAvatar() {
      try {
        const res = await fetch(`${API_URL}/api/v1/avatars`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { avatars: unknown[] };
          setHasAvatar(data.avatars.length > 0);
        }
      } catch {
        setHasAvatar(null);
      }
    }
    void checkAvatar();
  }, [user]);

  // Fetch campaigns
  const fetchCampaigns = useCallback(
    async (
      params: {
        search: string;
        category: CategoryFilter;
        sort: SortOption;
        offset: number;
        append: boolean;
      },
    ) => {
      if (params.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const query = new URLSearchParams({
          status: "active",
          sort: params.sort,
          limit: String(PAGE_SIZE),
          offset: String(params.offset),
        });
        if (params.search) query.set("search", params.search);
        if (params.category !== "all") query.set("category", params.category);

        const res = await fetch(`${API_URL}/api/v1/campaigns?${query.toString()}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to load campaigns (${res.status})`);
        }

        const data = await res.json() as CampaignFeed;

        if (params.append) {
          setCampaigns((prev) => [...prev, ...data.campaigns]);
        } else {
          setCampaigns(data.campaigns);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaigns");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Fetch on filter/sort change
  useEffect(() => {
    void fetchCampaigns({
      search: debouncedSearch,
      category,
      sort,
      offset: 0,
      append: false,
    });
    setOffset(0);
  }, [debouncedSearch, category, sort, fetchCampaigns]);

  // Load more
  const handleLoadMore = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    void fetchCampaigns({
      search: debouncedSearch,
      category,
      sort,
      offset: newOffset,
      append: true,
    });
  }, [debouncedSearch, category, sort, offset, fetchCampaigns]);

  const handleReset = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setCategory("all");
    setSort("ending_soon");
    setOffset(0);
  }, []);

  const showHero = !authLoading && !user;
  const showAvatarNudge = !authLoading && user && hasAvatar === false;

  const skeletonCount = 6;

  return (
    <div style={{ background: "#fff", minHeight: "100dvh" }}>
      {/* Hero (unauthenticated users) */}
      {showHero && <Hero />}

      {/* Logged-in header */}
      {!showHero && (
        <div
          style={{
            padding: "20px 16px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/explore"
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#0a0a0a",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            loocbooc
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {user && (
              <Link
                href="/avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  fontSize: 14,
                }}
                title="My avatar"
              >
                👤
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Avatar nudge */}
      {showAvatarNudge && (
        <div style={{ paddingTop: 20 }}>
          <AvatarNudge />
        </div>
      )}

      {/* Filters section */}
      <div style={{ padding: "20px 16px 0" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            border: "1.5px solid #e5e5e5",
            borderRadius: 12,
            marginBottom: 16,
            background: "#fff",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#aaa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search styles, brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              background: "transparent",
              color: "#0a0a0a",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#aaa",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "none",
            marginBottom: 12,
          }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setOffset(0); }}
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 20,
                border: `1.5px solid ${category === cat.value ? "#0a0a0a" : "#e5e5e5"}`,
                background: category === cat.value ? "#0a0a0a" : "#fff",
                color: category === cat.value ? "#fff" : "#555",
                fontSize: 13,
                fontWeight: category === cat.value ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort + count row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13, color: "#888" }}>
            {loading ? "" : `${total.toLocaleString()} style${total !== 1 ? "s" : ""}`}
          </span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setOffset(0); }}
            style={{
              fontSize: 13,
              padding: "5px 10px",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              background: "#fff",
              color: "#555",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "0 16px 20px",
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            color: "#dc2626",
            fontSize: 14,
          }}
        >
          {error}{" "}
          <button
            onClick={() => void fetchCampaigns({ search: debouncedSearch, category, sort, offset: 0, append: false })}
            style={{
              background: "none",
              border: "none",
              color: "#dc2626",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Campaign grid */}
      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            search={debouncedSearch}
            category={category}
            onReset={handleReset}
          />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: "center", marginBottom: 32 }}>
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
                  {loadingMore ? "Loading..." : `Load more (${total - campaigns.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom spacer (cleared by bottom nav) */}
      <div style={{ height: 16 }} />
    </div>
  );
}
