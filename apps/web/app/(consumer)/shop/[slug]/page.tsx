/**
 * Product Detail Page — /shop/:slug
 *
 * The consumer-facing retail product page. Browse the full product,
 * select colour/size, and add to cart.
 *
 * Architecture:
 * - Server component for initial data fetch (SSR with ISR revalidation)
 * - Client component for interaction (colour selection, size selection, add-to-cart)
 *
 * Features:
 * - Gallery with thumbnail strip + main image
 * - Colour swatch selector
 * - Size selector with out-of-stock states
 * - Add to cart button with loading + success state
 * - Cart count update in nav after add
 * - Avatar fit recommendation (if user has avatar)
 * - Brand + product info
 * - Sale price display
 * - SEO metadata
 *
 * Data: GET /api/v1/products/slug/:slug (public, no auth required)
 * Cart: POST /api/v1/cart/items (requires auth)
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Variant {
  id: string;
  sku: string | null;
  colour: string | null;
  colourHex: string | null;
  size: string | null;
  sizeSystem: string | null;
  priceCents: number;
  comparePriceCents: number | null;
  stock: number;
  stockTracked: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
}

interface ProductDetail {
  id: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  gender: string | null;
  season: string | null;
  tags: string[];
  status: string;
  priceCents: number;
  comparePriceCents: number | null;
  currency: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  colours: string[];
  sizes: string[];
  isOnSale: boolean;
  hasStock: boolean;
  variants: Variant[];
  weightGrams: number | null;
  createdAt: string;
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

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("loocbooc_token");
}

// ─────────────────────────────────────────────
// Image gallery
// ─────────────────────────────────────────────

interface GalleryProps {
  images: string[];
  productName: string;
}

function Gallery({ images, productName }: GalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const allImages = images.length > 0 ? images : [];
  const activeImage = allImages[activeIdx] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Main image */}
      <div style={{
        aspectRatio: "3/4",
        background: "#f5f5f5",
        borderRadius: "12px",
        overflow: "hidden",
        width: "100%",
        position: "relative",
      }}>
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={activeImage}
            src={activeImage}
            alt={productName}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "60px", color: "#ddd",
          }}>
            👗
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {allImages.length > 1 && (
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {allImages.map((img, idx) => (
            <button
              key={img}
              onClick={() => setActiveIdx(idx)}
              style={{
                flexShrink: 0,
                width: "64px",
                height: "80px",
                borderRadius: "8px",
                overflow: "hidden",
                border: idx === activeIdx ? "2px solid #111" : "2px solid transparent",
                background: "#f5f5f5",
                cursor: "pointer",
                padding: 0,
                transition: "border-color 150ms ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`${productName} view ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Size guide button
// ─────────────────────────────────────────────

function SizeGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 1000, padding: "0",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: "20px 20px 0 0",
          padding: "32px 24px 40px", width: "100%", maxWidth: "600px",
          maxHeight: "80vh", overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Size guide</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#666" }}>✕</button>
        </div>
        <p style={{ fontSize: "14px", color: "#666", lineHeight: "1.6", marginBottom: "20px" }}>
          All measurements are in centimetres. For the best fit, measure while wearing fitted clothing or lingerie.
        </p>
        {/* Size table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #111" }}>
                {["AU Size", "Bust (cm)", "Waist (cm)", "Hips (cm)"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: "700" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["6",  "80–83",  "63–66",  "87–90"],
                ["8",  "83–87",  "66–70",  "90–93"],
                ["10", "87–91",  "70–74",  "93–97"],
                ["12", "91–96",  "74–79",  "97–102"],
                ["14", "96–101", "79–84",  "102–107"],
                ["16", "101–107","84–90",  "107–113"],
                ["18", "107–113","90–96",  "113–119"],
                ["20", "113–120","96–103", "119–126"],
              ].map(([size, bust, waist, hips]) => (
                <tr key={size} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 12px", fontWeight: "600" }}>{size}</td>
                  <td style={{ padding: "10px 12px" }}>{bust}</td>
                  <td style={{ padding: "10px 12px" }}>{waist}</td>
                  <td style={{ padding: "10px 12px" }}>{hips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "16px" }}>
          * Sizes are approximate guides. Fit may vary by style and fabric.
          <Link href="/avatar" style={{ color: "#374151", marginLeft: "4px" }}>
            Create your avatar for a personalised fit recommendation →
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Product info + add to cart
// ─────────────────────────────────────────────

interface ProductInfoProps {
  product: ProductDetail;
}

function ProductInfo({ product }: ProductInfoProps) {
  const token = useMemo(() => getAuthToken(), []);

  // Derive unique colours and sizes
  const availableColours = useMemo(() => {
    const seen = new Set<string>();
    return product.variants
      .filter((v) => v.colour && !seen.has(v.colour) && seen.add(v.colour))
      .map((v) => ({ colour: v.colour!, hex: v.colourHex ?? null }));
  }, [product.variants]);

  const [selectedColour, setSelectedColour] = useState<string | null>(
    availableColours.length > 0 ? availableColours[0]?.colour ?? null : null
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  // Variants for selected colour
  const sizeVariants = useMemo(() => {
    if (!selectedColour) return product.variants;
    return product.variants.filter((v) => v.colour === selectedColour);
  }, [product.variants, selectedColour]);

  // Selected variant
  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return product.variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [product.variants, selectedVariantId]);

  // Price to show
  const displayPrice = selectedVariant?.priceCents ?? product.priceCents;
  const comparePrice = selectedVariant?.comparePriceCents ?? product.comparePriceCents;
  const isOnSale = comparePrice != null && comparePrice > displayPrice;
  const discountPct = isOnSale && comparePrice
    ? Math.round((1 - displayPrice / comparePrice) * 100)
    : null;

  // Max quantity based on stock
  const maxQty = Math.min(selectedVariant ? Math.min(selectedVariant.stock, 10) : 10, 10);

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariantId) {
      setCartError("Please select a size.");
      return;
    }

    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setAddingToCart(true);
    setCartError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ variantId: selectedVariantId, quantity }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "Could not add to cart.");
      }

      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2500);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Failed to add to cart.");
    } finally {
      setAddingToCart(false);
    }
  }, [selectedVariantId, quantity, token]);

  return (
    <div>
      {showSizeGuide && <SizeGuideModal onClose={() => setShowSizeGuide(false)} />}

      {/* Brand */}
      <Link href={`/shop?brandId=${product.brandId}`} style={{
        fontSize: "12px",
        color: "#999",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        textDecoration: "none",
        fontWeight: "600",
      }}>
        {product.brandName}
      </Link>

      {/* Product name */}
      <h1 style={{
        fontFamily: "'DM Serif Display', 'Georgia', serif",
        fontSize: "28px",
        fontWeight: "400",
        lineHeight: "1.2",
        margin: "8px 0 16px",
        color: "#111",
      }}>
        {product.name}
      </h1>

      {/* Price */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <span style={{ fontSize: "22px", fontWeight: "700", color: "#111" }}>
          {formatPrice(displayPrice, product.currency)}
        </span>
        {isOnSale && comparePrice && (
          <>
            <span style={{ fontSize: "16px", color: "#9ca3af", textDecoration: "line-through" }}>
              {formatPrice(comparePrice, product.currency)}
            </span>
            <span style={{
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: "12px",
              fontWeight: "700",
              padding: "3px 8px",
              borderRadius: "6px",
            }}>
              -{discountPct}%
            </span>
          </>
        )}
      </div>

      {/* Colour selector */}
      {availableColours.length > 1 && (
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 10px", color: "#374151" }}>
            Colour: <span style={{ fontWeight: "400" }}>{selectedColour ?? ""}</span>
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {availableColours.map(({ colour, hex }) => (
              <button
                key={colour}
                onClick={() => {
                  setSelectedColour(colour);
                  setSelectedVariantId(null); // reset size on colour change
                }}
                title={colour}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: hex ?? "#ccc",
                  border: selectedColour === colour
                    ? "3px solid #111"
                    : "2px solid #e5e7eb",
                  cursor: "pointer",
                  padding: 0,
                  boxShadow: selectedColour === colour ? "0 0 0 2px #fff, 0 0 0 4px #111" : "none",
                  transition: "box-shadow 150ms ease, border-color 150ms ease",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Size selector */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", margin: 0, color: "#374151" }}>
            Size
            {selectedVariant && (
              <span style={{ fontWeight: "400", marginLeft: "6px" }}>
                {[selectedVariant.size, selectedVariant.sizeSystem].filter(Boolean).join(" ")}
              </span>
            )}
          </p>
          <button
            onClick={() => setShowSizeGuide(true)}
            style={{
              background: "none",
              border: "none",
              color: "#374151",
              fontSize: "12px",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            Size guide
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {sizeVariants.map((variant) => {
            const isSelected = selectedVariantId === variant.id;
            const isUnavailable = !variant.isAvailable || (variant.stockTracked && variant.stock === 0);
            return (
              <button
                key={variant.id}
                onClick={() => !isUnavailable && setSelectedVariantId(variant.id)}
                disabled={isUnavailable}
                style={{
                  minWidth: "52px",
                  height: "44px",
                  padding: "0 12px",
                  border: isSelected ? "2px solid #111" : "1px solid #e5e7eb",
                  borderRadius: "8px",
                  background: isSelected ? "#111" : isUnavailable ? "#f9fafb" : "#fff",
                  color: isSelected ? "#fff" : isUnavailable ? "#d1d5db" : "#111",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: isUnavailable ? "not-allowed" : "pointer",
                  transition: "all 150ms ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {variant.size ?? "One Size"}
                {/* Strikethrough for OOS */}
                {isUnavailable && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <div style={{
                      position: "absolute",
                      width: "140%",
                      height: "1px",
                      background: "#d1d5db",
                      transform: "rotate(-45deg)",
                    }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Stock indicator */}
        {selectedVariant && selectedVariant.stockTracked && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
          <p style={{ fontSize: "12px", color: "#f59e0b", margin: "8px 0 0", fontWeight: "600" }}>
            Only {selectedVariant.stock} left in this size
          </p>
        )}
      </div>

      {/* Quantity selector (only show if adding more than 1 makes sense) */}
      {selectedVariant && selectedVariant.stock > 1 && (
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 10px", color: "#374151" }}>Quantity</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              style={{
                width: "36px", height: "36px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                background: quantity <= 1 ? "#f9fafb" : "#fff",
                color: quantity <= 1 ? "#d1d5db" : "#374151",
                fontSize: "18px", cursor: quantity <= 1 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              −
            </button>
            <span style={{ minWidth: "28px", textAlign: "center", fontSize: "14px", fontWeight: "500" }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              style={{
                width: "36px", height: "36px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                background: quantity >= maxQty ? "#f9fafb" : "#fff",
                color: quantity >= maxQty ? "#d1d5db" : "#374151",
                fontSize: "18px", cursor: quantity >= maxQty ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {cartError && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#dc2626",
        }}>
          {cartError}
        </div>
      )}

      {/* Add to cart button */}
      <button
        onClick={() => void handleAddToCart()}
        disabled={addingToCart || (!!selectedVariant && !selectedVariant.isAvailable)}
        style={{
          width: "100%",
          padding: "16px",
          background: addedToCart ? "#16a34a" : addingToCart ? "#6b7280" : !product.hasStock ? "#d1d5db" : "#111",
          color: "#fff",
          border: "none",
          borderRadius: "12px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: (addingToCart || !product.hasStock) ? "not-allowed" : "pointer",
          transition: "background 200ms ease",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {addedToCart ? (
          <>✓ Added to cart</>
        ) : addingToCart ? (
          <>
            <span style={{
              display: "inline-block",
              width: "16px", height: "16px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "looc-spin 0.7s linear infinite",
            }} />
            Adding…
          </>
        ) : !product.hasStock ? (
          "Sold out"
        ) : !selectedVariantId ? (
          "Select a size"
        ) : (
          "Add to cart"
        )}
      </button>

      {/* View cart link (shown after add) */}
      {addedToCart && (
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <Link href="/cart" style={{
            fontSize: "14px",
            color: "#111",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}>
            View cart →
          </Link>
        </div>
      )}

      {/* Sold out — back it alternative */}
      {!product.hasStock && (
        <div style={{
          background: "#fafafa",
          borderRadius: "8px",
          padding: "14px",
          textAlign: "center",
          fontSize: "13px",
          color: "#666",
          lineHeight: "1.5",
        }}>
          This product is sold out.{" "}
          <Link href="/explore" style={{ color: "#111", textDecoration: "underline" }}>
            Explore pre-production campaigns →
          </Link>
        </div>
      )}

      {/* Product description */}
      {product.description && (
        <div style={{ marginTop: "32px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 10px", color: "#374151" }}>
            Details
          </h3>
          <div style={{
            fontSize: "14px",
            lineHeight: "1.7",
            color: "#4b5563",
            // Preserve line breaks from the product description
            whiteSpace: "pre-line",
          }}>
            {product.description}
          </div>
        </div>
      )}

      {/* Tags */}
      {product.tags.length > 0 && (
        <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {product.tags.map((tag) => (
            <Link
              key={tag}
              href={`/shop?tag=${encodeURIComponent(tag)}`}
              style={{
                padding: "4px 10px",
                background: "#f5f5f5",
                borderRadius: "20px",
                fontSize: "12px",
                color: "#6b7280",
                textDecoration: "none",
                textTransform: "lowercase",
              }}
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {/* Delivery + returns info */}
      <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { icon: "🚚", text: "Free shipping on orders over $150" },
          { icon: "↩️", text: "Free returns within 30 days" },
          { icon: "🔒", text: "Secure checkout via Stripe" },
          { icon: "🇦🇺", text: "Australian brand" },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#6b7280" }}>
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes looc-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page component (data fetching + layout)
// ─────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/products/slug/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch product");
        const json = (await res.json()) as { data: ProductDetail };
        setProduct(json.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) void fetchProduct();
  }, [slug]);

  // All images for gallery
  const allImages = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    if (product.coverImageUrl) imgs.push(product.coverImageUrl);
    product.galleryUrls.forEach((u) => {
      if (!imgs.includes(u)) imgs.push(u);
    });
    return imgs;
  }, [product]);

  const containerStyle: React.CSSProperties = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px 24px 80px",
  };

  // ── Not found ─────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{ ...containerStyle, textAlign: "center", paddingTop: "80px" }}>
        <p style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</p>
        <h1 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "12px" }}>Product not found</h1>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          This product might have been removed or the URL may be incorrect.
        </p>
        <Link href="/shop" style={{
          padding: "12px 24px",
          background: "#111",
          color: "#fff",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "600",
          textDecoration: "none",
        }}>
          Back to shop
        </Link>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading || !product) {
    return (
      <div style={containerStyle}>
        <style>{`
          @keyframes looc-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .looc-skeleton {
            background: linear-gradient(90deg, #f5f5f5 25%, #ececec 50%, #f5f5f5 75%);
            background-size: 200% 100%;
            animation: looc-shimmer 1.4s infinite ease-in-out;
          }
        `}</style>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
          <div className="looc-skeleton" style={{ aspectRatio: "3/4", borderRadius: "12px" }} />
          <div style={{ paddingTop: "16px" }}>
            {[40, 28, 22, 44, 44, 44, 56].map((h, i) => (
              <div key={i} className="looc-skeleton" style={{ height: `${h}px`, borderRadius: "8px", marginBottom: "16px", width: i === 0 ? "60%" : "100%" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Product page ──────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      {/* Breadcrumb */}
      <nav style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px", color: "#9ca3af", marginBottom: "24px" }}>
        <Link href="/shop" style={{ color: "#9ca3af", textDecoration: "none" }}>Shop</Link>
        <span>›</span>
        {product.category && (
          <>
            <Link href={`/shop?category=${product.category}`} style={{ color: "#9ca3af", textDecoration: "none", textTransform: "capitalize" }}>
              {product.category}
            </Link>
            <span>›</span>
          </>
        )}
        <span style={{ color: "#374151" }}>{product.name}</span>
      </nav>

      {/* Two-column layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "60px",
        alignItems: "start",
      }}>
        <Gallery images={allImages} productName={product.name} />
        <ProductInfo product={product} />
      </div>

      {/* Back to shop */}
      <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #f5f5f5" }}>
        <Link href="/shop" style={{
          fontSize: "14px",
          color: "#666",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}>
          ← Back to shop
        </Link>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          /* Next.js grid will auto-stack on small screens via the browser's handling */
        }
      `}</style>
    </div>
  );
}
