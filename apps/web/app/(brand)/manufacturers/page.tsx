/**
 * Manufacturer Discovery Page — Brand view
 *
 * Layout:
 * - "Matched for you" section (algorithm picks, top of page)
 * - Filter sidebar (country, specialisation, certifications, MOQ, price tier)
 * - Pinterest-style grid of manufacturer cards
 *
 * Data fetching:
 * - Featured + matched manufacturers: server-side (SSR)
 * - Search results: client-side with URL-driven filter state
 *
 * Design: deference, clarity, depth — per design principles.
 * The manufacturer card is the hero. The UI gets out of the way.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AggregatedRatings {
  overall: number;
  quality: number;
  communication: number;
  timeliness: number;
  totalReviews: number;
}

interface ManufacturerSummary {
  id: string;
  displayName: string;
  heroImageUrl: string | null;
  country: string;
  city: string | null;
  moqMin: number;
  moqMax: number | null;
  sampleLeadTimeDays: number;
  bulkLeadTimeDays: number;
  specialisations: string[];
  certifications: string[];
  priceTier: string;
  isVerified: boolean;
  isFeatured: boolean;
  responseTimeHours: number | null;
  ratings: AggregatedRatings;
}

interface MatchedManufacturer extends ManufacturerSummary {
  matchScore: number;
  matchReasons: string[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SearchResult {
  data: ManufacturerSummary[];
  pagination: PaginationMeta;
}

// ─────────────────────────────────────────────
// Filter state
// ─────────────────────────────────────────────

interface Filters {
  country: string;
  specialisation: string;
  certifications: string;
  moqMin: string;
  moqMax: string;
  priceTier: string;
  isVerified: boolean;
}

const DEFAULT_FILTERS: Filters = {
  country: "",
  specialisation: "",
  certifications: "",
  moqMin: "",
  moqMax: "",
  priceTier: "",
  isVerified: false,
};

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PRICE_TIERS = [
  { value: "", label: "All tiers" },
  { value: "mass", label: "Mass market" },
  { value: "mid", label: "Mid-market" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

const SPECIALISATIONS = [
  "Woven", "Knitwear", "Denim", "Leather", "Jersey", "Swimwear",
  "Activewear", "Lingerie", "Outerwear", "Tailoring", "Embroidery",
  "Prints & Dyeing",
];

const CERTIFICATIONS = [
  "GOTS", "OEKO-TEX", "Fair Trade", "BSCI", "ISO 9001",
  "WRAP", "SA8000", "Bluesign",
];

const COUNTRY_OPTIONS = [
  { value: "", label: "All countries" },
  { value: "CN", label: "China" },
  { value: "VN", label: "Vietnam" },
  { value: "BD", label: "Bangladesh" },
  { value: "IN", label: "India" },
  { value: "TR", label: "Turkey" },
  { value: "PT", label: "Portugal" },
  { value: "IT", label: "Italy" },
  { value: "PK", label: "Pakistan" },
];

// ─────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────

function StarRating({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const filled = Math.round(score);
  return (
    <div className={`flex gap-0.5 ${size === "sm" ? "text-xs" : "text-sm"}`} aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= filled ? "text-amber-400" : "text-[var(--surface-3)]"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-xs font-medium">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M5 0L6.18 3.28L9.51 3.09L7.09 5.17L7.94 8.41L5 6.8L2.06 8.41L2.91 5.17L0.49 3.09L3.82 3.28L5 0Z" />
      </svg>
      Verified
    </span>
  );
}

function PriceTierBadge({ tier }: { tier: string }) {
  const config: Record<string, { label: string; class: string }> = {
    mass: { label: "Mass", class: "bg-[var(--surface-2)] text-[var(--text-secondary)]" },
    mid: { label: "Mid", class: "bg-blue-50 text-blue-600" },
    premium: { label: "Premium", class: "bg-purple-50 text-purple-600" },
    luxury: { label: "Luxury", class: "bg-amber-50 text-amber-700" },
  };
  const c = config[tier] ?? config.mid;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.class}`}>
      {c.label}
    </span>
  );
}

function ManufacturerCard({ manufacturer }: { manufacturer: ManufacturerSummary }) {
  const { displayName, heroImageUrl, country, city, moqMin, bulkLeadTimeDays, ratings, isVerified, priceTier, specialisations } = manufacturer;
  const location = [city, country].filter(Boolean).join(", ");
  const moqLabel = moqMin === 0 ? "No min" : `${moqMin.toLocaleString()} units min`;

  return (
    <Link
      href={`/manufacturers/${manufacturer.id}`}
      className="group block bg-[var(--surface-1)] rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-3)] transition-shadow duration-[var(--duration-normal)]"
    >
      {/* Hero image */}
      <div className="relative aspect-[4/3] bg-[var(--surface-2)] overflow-hidden">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={displayName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-[var(--duration-slow)]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[var(--text-tertiary)] text-4xl">🏭</span>
          </div>
        )}
        {isVerified && (
          <div className="absolute top-3 left-3">
            <VerifiedBadge />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <PriceTierBadge tier={priceTier} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-5">
        <h3 className="font-semibold text-[var(--text-primary)] text-base leading-snug mb-1 truncate">
          {displayName}
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mb-3">{location}</p>

        {/* Specialisations (first 2) */}
        {specialisations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {specialisations.slice(0, 2).map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text-secondary)] text-xs rounded-full"
              >
                {s}
              </span>
            ))}
            {specialisations.length > 2 && (
              <span className="px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text-tertiary)] text-xs rounded-full">
                +{specialisations.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Key specs */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-[var(--surface-3)] pt-4">
          <div>
            <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Min order</p>
            <p className="text-[var(--text-primary)] font-medium">{moqLabel}</p>
          </div>
          <div>
            <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Lead time</p>
            <p className="text-[var(--text-primary)] font-medium">{bulkLeadTimeDays}d bulk</p>
          </div>
          {ratings.totalReviews > 0 && (
            <div className="col-span-2 flex items-center gap-2 pt-1">
              <StarRating score={ratings.overall} />
              <span className="text-[var(--text-tertiary)] text-xs">
                {ratings.overall.toFixed(1)} · {ratings.totalReviews} review{ratings.totalReviews !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MatchCard({ manufacturer }: { manufacturer: MatchedManufacturer }) {
  return (
    <div className="relative">
      <div className="absolute -top-3 left-4 z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-xs font-semibold rounded-full">
          <span className="text-[var(--loocbooc-accent)]">●</span>
          {manufacturer.matchScore}% match
        </span>
      </div>
      <ManufacturerCard manufacturer={manufacturer} />
      {manufacturer.matchReasons.length > 0 && (
        <div className="px-5 pb-4 -mt-1 bg-[var(--surface-1)] rounded-b-[var(--radius-xl)] border-t-0">
          <p className="text-xs text-[var(--text-tertiary)] pt-3 border-t border-[var(--surface-3)]">
            {manufacturer.matchReasons[0]}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Filter sidebar
// ─────────────────────────────────────────────

function FilterSidebar({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: (key: keyof Filters, value: string | boolean) => void;
  onReset: () => void;
}) {
  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-6 bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-1)] space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Filters</h2>
          <button
            onClick={onReset}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Country */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            Country
          </label>
          <select
            value={filters.country}
            onChange={(e) => onChange("country", e.target.value)}
            className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)]"
          >
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Specialisation */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            Specialisation
          </label>
          <select
            value={filters.specialisation}
            onChange={(e) => onChange("specialisation", e.target.value)}
            className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)]"
          >
            <option value="">All specialisations</option>
            {SPECIALISATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Price tier */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            Price tier
          </label>
          <div className="space-y-1.5">
            {PRICE_TIERS.map((t) => (
              <label key={t.value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="priceTier"
                  value={t.value}
                  checked={filters.priceTier === t.value}
                  onChange={() => onChange("priceTier", t.value)}
                  className="accent-[var(--loocbooc-black)]"
                />
                <span className="text-sm text-[var(--text-primary)]">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* MOQ range */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            MOQ range
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.moqMin}
              onChange={(e) => onChange("moqMin", e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)]"
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.moqMax}
              onChange={(e) => onChange("moqMax", e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)]"
            />
          </div>
        </div>

        {/* Certifications */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            Certifications
          </label>
          <div className="space-y-1.5">
            {CERTIFICATIONS.map((cert) => {
              const current = filters.certifications.split(",").map((c) => c.trim()).filter(Boolean);
              const checked = current.includes(cert);
              return (
                <label key={cert} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...current, cert]
                        : current.filter((c) => c !== cert);
                      onChange("certifications", next.join(","));
                    }}
                    className="accent-[var(--loocbooc-black)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{cert}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Verified only */}
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.isVerified}
              onChange={(e) => onChange("isVerified", e.target.checked)}
              className="accent-[var(--loocbooc-black)]"
            />
            <span className="text-sm font-medium text-[var(--text-primary)]">Verified only</span>
          </label>
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-1)] animate-pulse">
      <div className="aspect-[4/3] bg-[var(--surface-2)]" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-[var(--surface-2)] rounded w-3/4" />
        <div className="h-3 bg-[var(--surface-2)] rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-5 bg-[var(--surface-2)] rounded-full w-16" />
          <div className="h-5 bg-[var(--surface-2)] rounded-full w-20" />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--surface-3)]">
          <div className="h-8 bg-[var(--surface-2)] rounded" />
          <div className="h-8 bg-[var(--surface-2)] rounded" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ManufacturersPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [matched, setMatched] = useState<MatchedManufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Debounce filter changes
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedFilters]);

  // Fetch search results
  const fetchManufacturers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedFilters.country) params.set("country", debouncedFilters.country);
      if (debouncedFilters.specialisation) params.set("specialisation", debouncedFilters.specialisation);
      if (debouncedFilters.certifications) params.set("certifications", debouncedFilters.certifications);
      if (debouncedFilters.moqMin) params.set("moqMin", debouncedFilters.moqMin);
      if (debouncedFilters.moqMax) params.set("moqMax", debouncedFilters.moqMax);
      if (debouncedFilters.priceTier) params.set("priceTier", debouncedFilters.priceTier);
      if (debouncedFilters.isVerified) params.set("isVerified", "true");
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/v1/manufacturers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch manufacturers");
      const data = await res.json() as SearchResult;
      setSearchResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page]);

  // Fetch matched manufacturers
  const fetchMatched = useCallback(async () => {
    setMatchLoading(true);
    try {
      const res = await fetch("/api/v1/manufacturers/matched", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return; // silently skip if not logged in or no brand
      const data = await res.json() as { matches: MatchedManufacturer[] };
      setMatched(data.matches);
    } catch {
      // Non-fatal
    } finally {
      setMatchLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchManufacturers();
  }, [fetchManufacturers]);

  useEffect(() => {
    void fetchMatched();
  }, [fetchMatched]);

  const handleFilterChange = (key: keyof Filters, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const manufacturers = searchResult?.data ?? [];
  const pagination = searchResult?.pagination;

  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)]">
      {/* Page header */}
      <header className="px-8 pt-10 pb-6 max-w-screen-2xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-[var(--text-primary)] mb-2">
              Find your manufacturer
            </h1>
            <p className="text-[var(--text-secondary)] text-lg">
              Verified factories. Real ratings. Direct connection.
            </p>
          </div>
          <Link
            href="/manufacturers/connections"
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 border border-[var(--surface-3)] rounded-[var(--radius-md)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            🤝 My connections
          </Link>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-8 pb-16">

        {/* Matched for you section */}
        {(matchLoading || matched.length > 0) && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-semibold text-xl text-[var(--text-primary)]">Matched for you</h2>
              <span className="px-2.5 py-0.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-xs font-medium rounded-full">
                AI
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {matchLoading
                ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
                : matched.map((m) => <MatchCard key={m.id} manufacturer={m} />)}
            </div>
          </section>
        )}

        {/* Main content: filters + grid */}
        <div className="flex gap-8 items-start">
          <FilterSidebar
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
          />

          <div className="flex-1 min-w-0">
            {/* Result count */}
            {!loading && pagination && (
              <p className="text-sm text-[var(--text-secondary)] mb-5">
                {pagination.total.toLocaleString()} manufacturer{pagination.total !== 1 ? "s" : ""} found
              </p>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading
                ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
                : manufacturers.length > 0
                ? manufacturers.map((m) => <ManufacturerCard key={m.id} manufacturer={m} />)
                : (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-5xl mb-4">🔍</p>
                    <p className="text-[var(--text-secondary)] text-lg font-medium mb-2">
                      No manufacturers match your filters
                    </p>
                    <p className="text-[var(--text-tertiary)]">
                      Try broadening your search or removing some filters.
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-6 px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--surface-3)] text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 rounded-[var(--radius-md)] border border-[var(--surface-3)] text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Auth helper (reads JWT from storage)
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}
