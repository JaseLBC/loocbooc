/**
 * Garment Library — /garments
 *
 * The Production Tool home. All garments owned by this brand, with search,
 * filter, and status tabs. Entry point to the 3D pipeline — each garment
 * can be in draft → processing → active as files are uploaded and processed.
 *
 * Layout:
 * - Header: title, "Add Garment" CTA, brand stats strip
 * - Filter bar: search input, category/season/status dropdowns
 * - Status tabs: All | Draft | Processing | Active | Archived
 * - Garment grid: card per garment — thumbnail, name, category, UGI, status badge
 * - Empty state for new brands
 *
 * Data: GET /api/v1/garments (brand-scoped by JWT)
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type GarmentStatus = "draft" | "processing" | "active" | "updating" | "error" | "archived";

interface GarmentSummary {
  ugi: string;
  id: string;
  name: string;
  category: string | null;
  season: string | null;
  sku: string | null;
  description: string | null;
  fabricComposition: string | null;
  status: GarmentStatus;
  hasModel3D: boolean;
  thumbnailUrl: string | null;
  tryOnCount: number;
  createdAt: string;
  updatedAt: string;
}

interface BrandStats {
  totalGarments: number;
  garmentsWith3D: number;
  totalTryOns: number;
  lastActivityAt: string | null;
}

interface GarmentListResponse {
  // The garments API returns { items, total, page, page_size, has_next }
  items: GarmentSummary[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────

const STATUS_TABS: Array<{ key: GarmentStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "processing", label: "Processing" },
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
];

function statusBadge(status: GarmentStatus) {
  const map: Record<GarmentStatus, { label: string; bg: string; color: string }> = {
    draft: { label: "Draft", bg: "#f5f5f5", color: "#666" },
    processing: { label: "Processing", bg: "#fef9c3", color: "#854d0e" },
    active: { label: "Active", bg: "#dcfce7", color: "#166534" },
    updating: { label: "Updating", bg: "#fef9c3", color: "#854d0e" },
    error: { label: "Error", bg: "#fee2e2", color: "#991b1b" },
    archived: { label: "Archived", bg: "#f5f5f5", color: "#999" },
  };
  return map[status] ?? { label: status, bg: "#f5f5f5", color: "#666" };
}

const CATEGORY_LABELS: Record<string, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  outerwear: "Outerwear",
  suits: "Suits",
  activewear: "Activewear",
  swimwear: "Swimwear",
  underwear: "Underwear",
  accessories: "Accessories",
  footwear: "Footwear",
  bags: "Bags",
  hats: "Hats",
  other: "Other",
};

function categoryIcon(category: string | null): string {
  const map: Record<string, string> = {
    tops: "👕",
    bottoms: "👖",
    dresses: "👗",
    outerwear: "🧥",
    suits: "🤵",
    activewear: "🏃",
    swimwear: "🩱",
    underwear: "🩲",
    accessories: "👜",
    footwear: "👠",
    bags: "👜",
    hats: "🎩",
    other: "📦",
  };
  return map[category ?? ""] ?? "📦";
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─────────────────────────────────────────────
// Garment card
// ─────────────────────────────────────────────

function GarmentCard({ garment }: { garment: GarmentSummary }) {
  const badge = statusBadge(garment.status);

  return (
    <Link href={`/garments/${garment.ugi}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        cursor: "pointer",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d1d1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e5e5";
        }}
      >
        {/* Thumbnail */}
        <div style={{
          height: 180,
          background: garment.thumbnailUrl ? `url(${garment.thumbnailUrl}) center/cover no-repeat` : "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          {!garment.thumbnailUrl && (
            <span style={{ fontSize: 48, opacity: 0.3 }}>{categoryIcon(garment.category)}</span>
          )}
          {/* 3D badge */}
          {garment.hasModel3D && (
            <div style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 7px",
              borderRadius: 20,
              letterSpacing: "0.02em",
            }}>3D</div>
          )}
          {/* Status badge */}
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: badge.bg,
            color: badge.color,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 7px",
            borderRadius: 20,
          }}>{badge.label}</div>
        </div>

        {/* Info */}
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {garment.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            {garment.category && (
              <span style={{ fontSize: 12, color: "#888" }}>
                {categoryIcon(garment.category)} {CATEGORY_LABELS[garment.category] ?? garment.category}
              </span>
            )}
            {garment.season && (
              <span style={{ fontSize: 12, color: "#bbb" }}>· {garment.season}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#aaa", background: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}>
              {garment.ugi}
            </span>
            <span style={{ fontSize: 11, color: "#bbb" }}>{relativeTime(garment.updatedAt)}</span>
          </div>
          {garment.tryOnCount > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#888" }}>
              👁 {garment.tryOnCount.toLocaleString()} try-on{garment.tryOnCount !== 1 ? "s" : ""}
            </div>
          )}
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
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ height: 180, background: "#f5f5f5" }} />
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ height: 16, background: "#f0f0f0", borderRadius: 4, marginBottom: 8, width: "70%" }} />
        <div style={{ height: 12, background: "#f5f5f5", borderRadius: 4, marginBottom: 12, width: "45%" }} />
        <div style={{ height: 12, background: "#f5f5f5", borderRadius: 4, width: "55%" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "64px 24px" }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>🔍</p>
        <h3 style={{ fontWeight: 600, fontSize: 16, color: "#1a1a1a", margin: "0 0 8px" }}>No garments match</h3>
        <p style={{ color: "#888", fontSize: 14, margin: 0 }}>Try adjusting your search or filters.</p>
      </div>
    );
  }
  return (
    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "80px 24px" }}>
      <p style={{ fontSize: 48, marginBottom: 20 }}>👗</p>
      <h3 style={{ fontWeight: 700, fontSize: 20, color: "#1a1a1a", margin: "0 0 12px" }}>Your garment library is empty</h3>
      <p style={{ color: "#888", fontSize: 15, margin: "0 0 28px", maxWidth: 360, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
        Upload your first style to start the 3D pipeline, get try-on data, and create Back It campaigns.
      </p>
      <Link href="/garments/new" style={{
        display: "inline-block",
        background: "#1a1a1a",
        color: "#fff",
        padding: "12px 24px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        textDecoration: "none",
      }}>
        Add your first garment
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function GarmentsPage() {
  const [garments, setGarments] = useState<GarmentSummary[]>([]);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [activeTab, setActiveTab] = useState<GarmentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [season, setSeason] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGarments = useCallback(async (currentPage: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "24",
        sortBy,
        sortOrder,
      });
      if (activeTab !== "all") params.set("status", activeTab);
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (season) params.set("season", season);

      const res = await fetch(`/api/v1/garments?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch garments");
      const data = (await res.json()) as GarmentListResponse;
      setGarments(data.items);
      setTotal(data.total);
      // Calculate totalPages from total and limit
      const pageSize = 24;
      setTotalPages(Math.max(1, Math.ceil(data.total / pageSize)));
    } catch {
      setGarments([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, category, season, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/v1/brand/stats", { headers: authHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as BrandStats;
      setStats(data);
    } catch { /* ignore */ } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
    void fetchGarments(1);
  }, [fetchGarments]);

  // Debounce search input
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(val);
    }, 350);
  }

  const isFiltered = activeTab !== "all" || !!search || !!category || !!season;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, minHeight: "100vh", background: "#fafafa" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 24, color: "#1a1a1a", margin: "0 0 4px" }}>Garment Library</h1>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            {statsLoading ? "Loading…" : `${stats?.totalGarments ?? 0} styles · ${stats?.garmentsWith3D ?? 0} with 3D · ${stats?.totalTryOns?.toLocaleString() ?? 0} try-ons`}
          </p>
        </div>
        <Link href="/garments/new" style={{
          background: "#1a1a1a",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span>+</span> Add Garment
        </Link>
      </div>

      {/* Stats strip */}
      {stats && !statsLoading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}>
          {[
            { label: "Total styles", value: stats.totalGarments },
            { label: "3D ready", value: stats.garmentsWith3D },
            { label: "Total try-ons", value: stats.totalTryOns.toLocaleString() },
            { label: "Last activity", value: stats.lastActivityAt ? relativeTime(stats.lastActivityAt) : "—" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: "16px 18px",
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #e5e5e5", paddingBottom: 0 }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              color: activeTab === tab.key ? "#1a1a1a" : "#aaa",
              borderBottom: activeTab === tab.key ? "2px solid #1a1a1a" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#bbb", fontSize: 14 }}>🔍</span>
          <input
            type="text"
            placeholder="Search garments…"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: 36,
              paddingRight: 16,
              paddingTop: 9,
              paddingBottom: 9,
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 13,
              background: "#fff",
              color: "#1a1a1a",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: "9px 12px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff", color: category ? "#1a1a1a" : "#999", cursor: "pointer" }}
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Season */}
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          style={{ padding: "9px 12px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff", color: season ? "#1a1a1a" : "#999", cursor: "pointer" }}
        >
          <option value="">All seasons</option>
          <option value="SS">SS</option>
          <option value="AW">AW</option>
          <option value="all-season">All Season</option>
          <option value="resort">Resort</option>
        </select>

        {/* Sort */}
        <select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split(":");
            setSortBy(by ?? "createdAt");
            setSortOrder(order ?? "desc");
          }}
          style={{ padding: "9px 12px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff", color: "#1a1a1a", cursor: "pointer" }}
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="status:asc">Status</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              setActiveTab("all");
              setSearch("");
              setSearchInput("");
              setCategory("");
              setSeason("");
            }}
            style={{ padding: "9px 14px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff", color: "#888", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Total count line */}
      {!loading && total > 0 && (
        <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 16px" }}>
          {total.toLocaleString()} garment{total !== 1 ? "s" : ""}
          {isFiltered ? " match your filters" : " total"}
        </p>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : garments.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          garments.map((g) => <GarmentCard key={g.ugi} garment={g} />)
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          <button
            disabled={page <= 1}
            onClick={() => { setPage(p => p - 1); void fetchGarments(page - 1); }}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              background: page <= 1 ? "#f5f5f5" : "#fff",
              color: page <= 1 ? "#ccc" : "#1a1a1a",
              cursor: page <= 1 ? "default" : "pointer",
              fontWeight: 500,
              fontSize: 13,
            }}
          >← Prev</button>
          <span style={{ padding: "8px 16px", fontSize: 13, color: "#888" }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => { setPage(p => p + 1); void fetchGarments(page + 1); }}
            style={{
              padding: "8px 16px",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              background: page >= totalPages ? "#f5f5f5" : "#fff",
              color: page >= totalPages ? "#ccc" : "#1a1a1a",
              cursor: page >= totalPages ? "default" : "pointer",
              fontWeight: 500,
              fontSize: 13,
            }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
