/**
 * Consumer Shop — /shop
 *
 * The Loocbooc retail storefront. Browse in-stock products from all brands on the platform.
 * Distinct from /explore (Back It pre-order campaigns) — these are ready-to-buy now.
 *
 * Features:
 * - Product grid with search, category filter, price filter, sort
 * - Colour swatch preview per product card
 * - Sale badge (compare price shown)
 * - Avatar fit hint (if user has avatar, show recommended size on hover)
 * - Load more pagination
 * - Empty state with link to explore (campaigns)
 * - Skeleton loading on initial fetch
 *
 * Data: GET /api/v1/products (public — no auth required)
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ProductSummary {
  id: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  name: string;
  slug: string;
  category: string | null;
  gender: string | null;
  tags: string[];
  status: string;
  priceCents: number;
  comparePriceCents: number | null;
  currency: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  totalSold: number;
  colours: string[];
  sizes: string[];
  isOnSale: boolean;
  hasStock: boolean;
}

interface BrowseResult {
  data: ProductSummary[];
  total: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const CATEGORIES = [
  "dress", "top", "jacket", "coat", "trouser", "skirt", "short", "jumpsuit", "knitwear", "swimwear",
];

// ─────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────

function ProductCard({ product }: { product: ProductSummary }) {
  const [hovered, setHovered] = useState(false);

  const discountPercent =
    product.comparePriceCents && product.isOnSale
      ? Math.round((1 - product.priceCents / product.comparePriceCents) * 100)
      : null;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        .product-card-img {
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .product-card-img:hover {
          transform: scale(1.03);
        }
      `}</style>

      {/* Image */}
      <div
        style={{
          position: "relative",
          aspectRatio: "3/4",
          background: "#f2f2f2",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
          marginBottom: "12px",
        }}
      >
        {product.coverImageUrl ? (
          <img
            src={product.coverImageUrl}
            alt={product.name}
            className="product-card-img"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#ccc", fontSize: "40px",
          }}>
            👗
          </div>
        )}

        {/* Sale badge */}
        {discountPercent && (
          <div style={{
            position: "absolute", top: "10px", left: "10px",
            background: "#ef4444", color: "#fff",
            borderRadius: "6px", padding: "3px 8px",
            fontSize: "12px", fontWeight: 700,
          }}>
            -{discountPercent}%
          </div>
        )}

        {/* Out of stock overlay */}
        {!product.hasStock && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(255,255,255,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#666" }}>Sold Out</span>
          </div>
        )}

        {/* Size chips on hover */}
        {hovered && product.sizes.length > 0 && product.hasStock && (
          <div style={{
            position: "absolute", bottom: "10px", left: "10px", right: "10px",
            display: "flex", flexWrap: "wrap", gap: "4px",
          }}>
            {product.sizes.slice(0, 6).map((size) => (
              <span key={size} style={{
                background: "rgba(255,255,255,0.95)",
                borderRadius: "4px", padding: "2px 6px",
                fontSize: "11px", fontWeight: 600, color: "#1a1a1a",
              }}>
                {size}
              </span>
            ))}
            {product.sizes.length > 6 && (
              <span style={{
                background: "rgba(255,255,255,0.95)",
                borderRadius: "4px", padding: "2px 6px",
                fontSize: "11px", color: "#666",
              }}>
                +{product.sizes.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <div style={{ fontSize: "11px", color: "#999", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {product.brandName}
        </div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a1a", marginBottom: "6px", lineHeight: 1.3 }}>
          {product.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>
            {formatPrice(product.priceCents, product.currency)}
          </span>
          {product.isOnSale && product.comparePriceCents && (
            <span style={{ fontSize: "13px", color: "#999", textDecoration: "line-through" }}>
              {formatPrice(product.comparePriceCents, product.currency)}
            </span>
          )}
        </div>

        {/* Colour swatches */}
        {product.colours.length > 1 && (
          <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
            {product.colours.slice(0, 5).map((colour) => (
              <div key={colour} style={{
                width: "12px", height: "12px",
                borderRadius: "50%",
                background: colour.toLowerCase().startsWith("#") ? colour : "#ccc",
                border: "1px solid rgba(0,0,0,0.15)",
                title: colour,
              }} />
            ))}
            {product.colours.length > 5 && (
              <span style={{ fontSize: "11px", color: "#999", lineHeight: "12px" }}>+{product.colours.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div>
      <div style={{
        aspectRatio: "3/4",
        background: "linear-gradient(90deg, #f2f2f2 25%, #e8e8e8 50%, #f2f2f2 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: "12px",
        marginBottom: "12px",
      }} />
      <div style={{ height: "11px", background: "#f2f2f2", borderRadius: "4px", width: "60%", marginBottom: "6px" }} />
      <div style={{ height: "14px", background: "#f2f2f2", borderRadius: "4px", width: "80%", marginBottom: "6px" }} />
      <div style={{ height: "14px", background: "#f2f2f2", borderRadius: "4px", width: "40%" }} />
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
// Main page
// ─────────────────────────────────────────────

export default function ShopPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc" | "best_selling">("newest");

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);

  const fetchProducts = useCallback(async (opts: {
    reset?: boolean;
    searchVal?: string;
    categoryVal?: string;
    sortVal?: string;
  } = {}) => {
    const { reset = false, searchVal = search, categoryVal = category, sortVal = sort } = opts;

    if (reset) {
      offset.current = 0;
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: "24",
        offset: String(offset.current),
        sort: sortVal,
        ...(searchVal ? { search: searchVal } : {}),
        ...(categoryVal ? { category: categoryVal } : {}),
      });

      const res = await fetch(`${API_BASE}/api/v1/products?${params}`);
      if (!res.ok) throw new Error("Failed to load products");

      const json = (await res.json()) as BrowseResult;

      if (reset) {
        setProducts(json.data);
      } else {
        setProducts((prev) => [...prev, ...json.data]);
      }
      setTotal(json.total);
      setHasMore(json.hasMore);
      offset.current += json.data.length;
    } catch {
      setError("Failed to load products. Please refresh and try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, category, sort]);

  // Initial load
  useEffect(() => {
    void fetchProducts({ reset: true });
  }, []);

  // Re-fetch when category or sort changes
  useEffect(() => {
    void fetchProducts({ reset: true, categoryVal: category, sortVal: sort });
  }, [category, sort]);

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      void fetchProducts({ reset: true, searchVal: val });
    }, 350);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      paddingBottom: "100px", // bottom nav clearance
    }}>
      <style>{`
        .shop-filter-tab {
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s;
          white-space: nowrap;
          background: transparent;
          color: #666;
        }
        .shop-filter-tab.active {
          background: #1a1a1a;
          color: #fff;
        }
        .shop-filter-tab:not(.active):hover {
          background: #f5f5f5;
          color: #1a1a1a;
        }
        .shop-sort-select {
          border: 1px solid #e5e5e5;
          borderRadius: 8px;
          padding: 8px 12px;
          fontSize: 14px;
          background: #fff;
          cursor: pointer;
          outline: none;
          color: #1a1a1a;
        }
        .load-more-btn {
          border: 1.5px solid #1a1a1a;
          background: transparent;
          color: #1a1a1a;
          padding: 12px 32px;
          borderRadius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .load-more-btn:hover {
          background: #1a1a1a;
          color: #fff;
        }
        .load-more-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "32px 20px 0",
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        <div style={{ marginBottom: "8px" }}>
          <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 400, margin: 0, lineHeight: 1.1 }}>
            Shop
          </h1>
          <p style={{ color: "#666", fontSize: "15px", margin: "6px 0 0" }}>
            Ready to buy, today.{total > 0 && ` ${total.toLocaleString()} ${total === 1 ? "product" : "products"}.`}
          </p>
        </div>

        {/* Search bar */}
        <div style={{ marginTop: "20px", marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1.5px solid #e5e5e5",
              fontSize: "14px",
              outline: "none",
              color: "#1a1a1a",
            }}
          />
        </div>

        {/* Category tabs + Sort */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          overflowX: "auto",
          paddingBottom: "12px",
        }}>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button
              className={`shop-filter-tab${category === "" ? " active" : ""}`}
              onClick={() => setCategory("")}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`shop-filter-tab${category === cat ? " active" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <select
            className="shop-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="best_selling">Best Selling</option>
          </select>
        </div>

        <div style={{ height: "1px", background: "#f0f0f0", marginBottom: "24px" }} />
      </div>

      {/* Product grid */}
      <div style={{ padding: "0 20px", maxWidth: "1200px", margin: "0 auto" }}>
        {error ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            color: "#ef4444", fontSize: "15px",
          }}>
            {error}
          </div>
        ) : loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "28px",
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🛍️</div>
            <h3 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "22px", fontWeight: 400, marginBottom: "8px" }}>
              Nothing here yet
            </h3>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>
              {search || category
                ? "No products match your filters. Try clearing them."
                : "No products are listed yet. Check back soon, or browse campaigns."}
            </p>
            {(search || category) ? (
              <button
                onClick={() => { setSearch(""); setCategory(""); void fetchProducts({ reset: true, searchVal: "", categoryVal: "" }); }}
                style={{ background: "#1a1a1a", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                Clear Filters
              </button>
            ) : (
              <Link href="/explore" style={{ background: "#1a1a1a", color: "#fff", textDecoration: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600 }}>
                Browse Campaigns
              </Link>
            )}
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "28px",
            }}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "48px" }}>
                <button
                  className="load-more-btn"
                  onClick={() => void fetchProducts()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : `Load More (${total - products.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
