/**
 * Shop Purchase Success Page — order confirmation after checkout.
 *
 * Features:
 * - Order confirmation with order number
 * - Estimated delivery date
 * - Order summary with items
 * - Links to order tracking and continue shopping
 *
 * Route: /shop/[slug]/success?orderId=xxx
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OrderItem {
  id: string;
  productName: string;
  variantName: string;
  size: string;
  quantity: number;
  price: number;
  imageUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  estimatedDelivery: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCurrency(cents: number, currency: string = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function ShopSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError(true);
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const token = localStorage.getItem("loocbooc_token");
        const res = await fetch(`/api/v1/retail/orders/${orderId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error();

        const data = await res.json();
        setOrder(data.order);
      } catch {
        // Mock data for development
        setOrder({
          id: orderId,
          orderNumber: `LB-${Date.now().toString(36).toUpperCase()}`,
          status: "confirmed",
          totalAmount: 28500,
          currency: "AUD",
          items: [
            {
              id: "1",
              productName: "Tailored Wool Blazer",
              variantName: "Navy",
              size: "M",
              quantity: 1,
              price: 28500,
              imageUrl: null,
            },
          ],
          shippingAddress: {
            name: "Customer Name",
            line1: "123 Example Street",
            city: "Brisbane",
            state: "QLD",
            postalCode: "4000",
            country: "Australia",
          },
          estimatedDelivery: new Date(Date.now() + 86400000 * 7).toISOString(),
          createdAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #0a0a0a",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>❓</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
            Order not found
          </h1>
          <p style={{ color: "#666", fontSize: 14, margin: "0 0 24px" }}>
            We couldn&apos;t find this order. Please check your email for confirmation.
          </p>
          <Link
            href="/orders"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#0a0a0a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            View my orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#fff",
        paddingBottom: 100,
      }}
    >
      {/* Success header */}
      <div
        style={{
          background: "linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            background: "#16a34a",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l5 5L20 7"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#0a0a0a",
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          Order confirmed!
        </h1>
        <p style={{ fontSize: 14, color: "#166534", margin: 0 }}>
          Order #{order.orderNumber}
        </p>
      </div>

      {/* Order details */}
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "24px 16px" }}>
        {/* Estimated delivery */}
        {order.estimatedDelivery && (
          <div
            style={{
              padding: 20,
              background: "#fafafa",
              borderRadius: 12,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}>
              Estimated delivery
            </p>
            <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {formatDate(order.estimatedDelivery)}
            </p>
          </div>
        )}

        {/* Items */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e5e5e5",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#888" }}>
              {order.items.length} {order.items.length === 1 ? "item" : "items"}
            </p>
          </div>

          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                gap: 16,
                padding: 16,
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  background: item.imageUrl
                    ? `url(${item.imageUrl}) center/cover`
                    : "#f4f4f5",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!item.imageUrl && <span style={{ fontSize: 24 }}>👗</span>}
              </div>

              {/* Details */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
                  {item.productName}
                </p>
                <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>
                  {item.variantName} · Size {item.size} · Qty {item.quantity}
                </p>
              </div>

              {/* Price */}
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                {formatCurrency(item.price, order.currency)}
              </p>
            </div>
          ))}

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 16,
              background: "#fafafa",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Total</p>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {formatCurrency(order.totalAmount, order.currency)}
            </p>
          </div>
        </div>

        {/* Shipping address */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px", color: "#888" }}>
            Shipping to
          </p>
          <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            {order.shippingAddress.name}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 && (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            )}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
            {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.country}
          </p>
        </div>

        {/* Confirmation message */}
        <div
          style={{
            padding: 16,
            background: "#eff6ff",
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 13, color: "#1d4ed8", margin: 0 }}>
            📧 A confirmation email has been sent to your email address with your order
            details and tracking information.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/orders"
            style={{
              display: "block",
              padding: "14px 24px",
              background: "#0a0a0a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            View my orders
          </Link>
          <Link
            href="/shop"
            style={{
              display: "block",
              padding: "14px 24px",
              background: "#fff",
              border: "1px solid #e5e5e5",
              color: "#0a0a0a",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
