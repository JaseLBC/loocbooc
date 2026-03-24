/**
 * Consumer Orders — /orders
 *
 * The consumer's retail order history. Shows all orders placed through the
 * Loocbooc retail shop (distinct from /backings, which shows Back It pre-orders).
 *
 * Features:
 * - Order list with status badges, item count, total, tracking
 * - Expandable rows to see full order detail (items, shipping address)
 * - Status filter tabs
 * - Infinite scroll / load more
 * - Empty state with shop CTA
 * - Auth gate (sign-in redirect if not authenticated)
 * - Tracking link if carrier + number available
 *
 * Data:
 *   GET /api/v1/retail/orders           — paginated order list
 *   GET /api/v1/retail/orders/:orderId  — full order detail (on row expand)
 *
 * Design: consistent with /backings — list-based, status-centric,
 * action-oriented for orders that need attention.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OrderSummary {
  id: string;
  status: string;
  brandId: string;
  brandName: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  shippedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
}

interface OrderItem {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  imageUrl: string | null;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string;
}

interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  stripePaymentIntentId: string | null;
  deliveredAt: string | null;
}

type OrderStatus =
  | "pending"
  | "payment_processing"
  | "payment_failed"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

type FilterTab = "all" | "confirmed" | "shipped" | "delivered" | "cancelled";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("loocbooc_token");
}

function getStatusConfig(status: string): { label: string; bg: string; color: string; emoji: string } {
  const configs: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
    pending:            { label: "Pending",          bg: "#fef9c3", color: "#854d0e", emoji: "⏳" },
    payment_processing: { label: "Processing",       bg: "#fef9c3", color: "#854d0e", emoji: "⏳" },
    payment_failed:     { label: "Payment failed",   bg: "#fef2f2", color: "#991b1b", emoji: "❌" },
    confirmed:          { label: "Confirmed",         bg: "#eff6ff", color: "#1d4ed8", emoji: "✅" },
    in_production:      { label: "In production",    bg: "#eff6ff", color: "#1d4ed8", emoji: "🏭" },
    shipped:            { label: "Shipped",           bg: "#f0fdf4", color: "#166534", emoji: "📦" },
    delivered:          { label: "Delivered",         bg: "#f0fdf4", color: "#166534", emoji: "🎉" },
    cancelled:          { label: "Cancelled",         bg: "#f9fafb", color: "#6b7280", emoji: "🚫" },
    refunded:           { label: "Refunded",          bg: "#f9fafb", color: "#6b7280", emoji: "↩️" },
  };
  return configs[status] ?? { label: status, bg: "#f9fafb", color: "#6b7280", emoji: "•" };
}

function getTrackingUrl(carrier: string | null, trackingNumber: string): string | null {
  if (!carrier) return null;
  const urls: Record<string, string> = {
    "Australia Post": `https://auspost.com.au/mypost/track/#/details/${trackingNumber}`,
    "AusPost":        `https://auspost.com.au/mypost/track/#/details/${trackingNumber}`,
    "Sendle":         `https://track.sendle.com/tracking?ref=${trackingNumber}`,
    "StarTrack":      `https://www.startrack.com.au/tracking?ref=${trackingNumber}`,
    "DHL":            `https://www.dhl.com/au-en/home/tracking.html?tracking-id=${trackingNumber}`,
    "FedEx":          `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`,
    "UPS":            `https://www.ups.com/track?tracknum=${trackingNumber}`,
  };
  return urls[carrier] ?? null;
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Order detail panel (expanded)
// ─────────────────────────────────────────────

interface OrderDetailPanelProps {
  orderId: string;
  token: string;
}

function OrderDetailPanel({ orderId, token }: OrderDetailPanelProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/retail/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Could not load order details");
        const json = (await res.json()) as { data: OrderDetail };
        setDetail(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load details");
      } finally {
        setLoading(false);
      }
    };
    void fetchDetail();
  }, [orderId, token]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ padding: "20px", color: "#ef4444", fontSize: "14px" }}>
        {error ?? "Could not load order details."}
      </div>
    );
  }

  const addr = detail.shippingAddress;
  const trackingUrl = detail.trackingNumber
    ? getTrackingUrl(detail.trackingCarrier, detail.trackingNumber)
    : null;

  return (
    <div style={{
      borderTop: "1px solid #f0f0f0",
      padding: "20px 0 4px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "24px",
    }}>
      {/* Order items */}
      <div>
        <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#374151", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Items
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {detail.items.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{
                width: "48px",
                height: "56px",
                borderRadius: "6px",
                background: "#f5f5f5",
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : "👗"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "500", color: "#111" }}>
                  {item.productName}
                </p>
                {item.variantLabel && (
                  <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#9ca3af" }}>{item.variantLabel}</p>
                )}
                <p style={{ margin: "0", fontSize: "13px", color: "#666" }}>
                  Qty {item.quantity} · {formatPrice(item.totalCents, detail.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping + tracking */}
      <div>
        <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#374151", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Delivery
        </h4>

        {/* Shipping address */}
        <div style={{ fontSize: "13px", color: "#4b5563", lineHeight: "1.7", marginBottom: "16px" }}>
          <p style={{ margin: 0, fontWeight: "500" }}>{addr.firstName} {addr.lastName}</p>
          <p style={{ margin: 0 }}>{addr.line1}</p>
          {addr.line2 && <p style={{ margin: 0 }}>{addr.line2}</p>}
          <p style={{ margin: 0 }}>{addr.city} {addr.state} {addr.postcode}</p>
          <p style={{ margin: 0 }}>{addr.country}</p>
          {addr.phone && <p style={{ margin: "4px 0 0", color: "#9ca3af" }}>{addr.phone}</p>}
        </div>

        {/* Tracking info */}
        {detail.trackingNumber && (
          <div style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "8px",
            padding: "12px",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#166534", fontWeight: "600" }}>
              📦 Tracking number
            </p>
            {trackingUrl ? (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "13px", fontFamily: "monospace", color: "#15803d", textDecoration: "underline" }}
              >
                {detail.trackingNumber}
              </a>
            ) : (
              <p style={{ margin: 0, fontSize: "13px", fontFamily: "monospace", color: "#166534" }}>
                {detail.trackingNumber}
              </p>
            )}
            {detail.trackingCarrier && (
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#4ade80" }}>
                via {detail.trackingCarrier}
              </p>
            )}
          </div>
        )}

        {detail.shippedAt && (
          <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#6b7280" }}>
            Shipped {formatDate(detail.shippedAt)}
          </p>
        )}
        {detail.deliveredAt && (
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#16a34a" }}>
            Delivered {formatDate(detail.deliveredAt)} ✓
          </p>
        )}
      </div>

      {/* Order meta */}
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #f0f0f0", paddingTop: "16px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "12px", color: "#9ca3af" }}>
          <span>Order ID: </span>
          <span style={{ fontFamily: "monospace", color: "#6b7280" }}>{detail.id.slice(0, 8).toUpperCase()}</span>
        </div>
        {detail.stripePaymentIntentId && (
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>
            <span>Payment ref: </span>
            <span style={{ fontFamily: "monospace", color: "#6b7280" }}>{detail.stripePaymentIntentId.slice(0, 18)}…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Order card
// ─────────────────────────────────────────────

interface OrderCardProps {
  order: OrderSummary;
  token: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function OrderCard({ order, token, isExpanded, onToggle }: OrderCardProps) {
  const trackingUrl = order.trackingNumber
    ? getTrackingUrl(order.trackingCarrier, order.trackingNumber)
    : null;

  return (
    <div style={{
      border: "1px solid #f0f0f0",
      borderRadius: "12px",
      overflow: "hidden",
      background: "#fff",
      transition: "box-shadow 150ms ease",
    }}>
      {/* Card header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "20px",
          textAlign: "left",
          display: "flex",
          gap: "16px",
          alignItems: "flex-start",
        }}
      >
        {/* Brand initial avatar */}
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "10px",
          background: "#111",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          fontWeight: "700",
          flexShrink: 0,
          fontFamily: "'DM Serif Display', 'Georgia', serif",
        }}>
          {order.brandName[0]?.toUpperCase() ?? "?"}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>
              {order.brandName}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: "#6b7280" }}>
            <span>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</span>
            <span>{formatPrice(order.totalCents, order.currency)}</span>
            <span>{formatDate(order.createdAt)}</span>
          </div>

          {/* Quick tracking badge on list item */}
          {order.trackingNumber && order.status === "shipped" && (
            <div style={{ marginTop: "8px" }}>
              {trackingUrl ? (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    color: "#15803d",
                    textDecoration: "underline",
                    background: "#f0fdf4",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  📦 Track shipment →
                </a>
              ) : (
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Tracking: {order.trackingNumber}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <span style={{
          fontSize: "12px",
          color: "#9ca3af",
          transform: isExpanded ? "rotate(180deg)" : "none",
          transition: "transform 200ms ease",
          flexShrink: 0,
          paddingTop: "2px",
        }}>
          ▼
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ padding: "0 20px 20px" }}>
          <OrderDetailPanel orderId={order.id} token={token} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Filter tabs
// ─────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string; statuses: OrderStatus[] }[] = [
  { key: "all",       label: "All",       statuses: [] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed", "in_production"] },
  { key: "shipped",   label: "Shipped",   statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled", "refunded", "payment_failed"] },
];

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────

function OrderSkeleton() {
  return (
    <div style={{
      border: "1px solid #f0f0f0",
      borderRadius: "12px",
      padding: "20px",
      display: "flex",
      gap: "16px",
      alignItems: "flex-start",
    }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f0f0f0" }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "16px", borderRadius: "6px", background: "#f0f0f0", width: "40%", marginBottom: "10px" }} />
        <div style={{ height: "13px", borderRadius: "6px", background: "#f5f5f5", width: "70%" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => getAuthToken(), []);

  // ── Build status filter query ─────────────────────────────────────────

  const statusFilter = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.key === activeTab);
    return tab?.statuses ?? [];
  }, [activeTab]);

  // ── Fetch orders ──────────────────────────────────────────────────────

  const fetchOrders = useCallback(async (off: number, append = false) => {
    if (!token) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: off.toString(),
    });

    if (statusFilter.length > 0) {
      statusFilter.forEach((s) => params.append("status", s));
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/retail/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load orders");

      const json = (await res.json()) as { data: OrderSummary[]; total: number; hasMore: boolean };

      if (append) {
        setOrders((prev) => [...prev, ...json.data]);
      } else {
        setOrders(json.data);
      }

      setTotal(json.total);
      setHasMore(json.hasMore);
      setOffset(off + json.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, statusFilter]);

  // Reset and fetch on tab change
  useEffect(() => {
    setLoading(true);
    setOffset(0);
    setExpandedOrderId(null);
    void fetchOrders(0, false);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    void fetchOrders(offset, true);
  }, [offset, fetchOrders]);

  // ── Tab counts ────────────────────────────────────────────────────────

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: orders.length,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      if (["confirmed", "in_production"].includes(o.status)) counts.confirmed++;
      if (o.status === "shipped") counts.shipped++;
      if (o.status === "delivered") counts.delivered++;
      if (["cancelled", "refunded", "payment_failed"].includes(o.status)) counts.cancelled++;
    });
    return counts;
  }, [orders]);

  // ── Auth gate ─────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div style={{
        maxWidth: "560px",
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "48px", marginBottom: "16px" }}>🛍️</p>
        <h1 style={{
          fontFamily: "'DM Serif Display', 'Georgia', serif",
          fontSize: "26px",
          fontWeight: "400",
          margin: "0 0 12px",
          color: "#111",
        }}>
          Your orders
        </h1>
        <p style={{ color: "#666", marginBottom: "28px", lineHeight: "1.6" }}>
          Sign in to view your order history.
        </p>
        <Link href="/login?next=/orders" style={{
          display: "inline-block",
          padding: "12px 28px",
          background: "#111",
          color: "#fff",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "600",
          textDecoration: "none",
        }}>
          Sign in
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    maxWidth: "860px",
    margin: "0 auto",
    padding: "32px 24px 80px",
    minHeight: "60vh",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "8px" }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', 'Georgia', serif",
          fontSize: "32px",
          fontWeight: "400",
          margin: "0",
          color: "#111",
        }}>
          Orders
        </h1>
        {total > 0 && (
          <span style={{ fontSize: "14px", color: "#9ca3af" }}>
            {total} total
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{
        display: "flex",
        gap: "4px",
        marginBottom: "24px",
        borderBottom: "1px solid #f0f0f0",
        overflowX: "auto",
        paddingBottom: "0",
      }}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: isActive ? "600" : "400",
                color: isActive ? "#111" : "#9ca3af",
                borderBottom: isActive ? "2px solid #111" : "2px solid transparent",
                marginBottom: "-1px",
                whiteSpace: "nowrap",
                transition: "color 150ms, border-color 150ms",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab.label}
              {count > 0 && tab.key !== "all" && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "10px",
                  background: isActive ? "#111" : "#e5e7eb",
                  color: isActive ? "#fff" : "#6b7280",
                  fontSize: "11px",
                  fontWeight: "700",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((i) => <OrderSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</p>
          <p style={{ color: "#ef4444", marginBottom: "20px" }}>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              void fetchOrders(0, false);
            }}
            style={{
              padding: "10px 24px",
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", maxWidth: "360px", margin: "0 auto" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>📦</p>
          <h2 style={{
            fontFamily: "'DM Serif Display', 'Georgia', serif",
            fontSize: "24px",
            fontWeight: "400",
            margin: "0 0 12px",
            color: "#111",
          }}>
            {activeTab === "all" ? "No orders yet" : `No ${activeTab} orders`}
          </h2>
          <p style={{ color: "#666", marginBottom: "28px", lineHeight: "1.6", fontSize: "15px" }}>
            {activeTab === "all"
              ? "Your order history will appear here once you've made a purchase."
              : `You have no ${activeTab} orders at the moment.`}
          </p>
          {activeTab === "all" && (
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/shop" style={{
                padding: "12px 24px",
                background: "#111",
                color: "#fff",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
              }}>
                Browse the shop
              </Link>
              <Link href="/explore" style={{
                padding: "12px 24px",
                background: "#f5f5f5",
                color: "#111",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
              }}>
                Back a campaign
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                token={token}
                isExpanded={expandedOrderId === order.id}
                onToggle={() => setExpandedOrderId((prev) => prev === order.id ? null : order.id)}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "32px" }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  padding: "11px 28px",
                  background: "none",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? "Loading…" : `Load more (${total - offset} remaining)`}
              </button>
            </div>
          )}

          {/* Footer context */}
          {!hasMore && orders.length > 0 && (
            <p style={{ textAlign: "center", fontSize: "13px", color: "#d1d5db", marginTop: "32px" }}>
              All {total} orders shown
            </p>
          )}
        </>
      )}

      {/* Link to Back It backings */}
      <div style={{
        marginTop: "48px",
        paddingTop: "24px",
        borderTop: "1px solid #f5f5f5",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 8px" }}>
          Looking for your Back It pre-orders?
        </p>
        <Link href="/backings" style={{
          fontSize: "13px",
          color: "#374151",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}>
          View my backings →
        </Link>
      </div>
    </div>
  );
}
