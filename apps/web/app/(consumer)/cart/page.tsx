/**
 * Consumer Shopping Cart — /cart
 *
 * The retail checkout flow. Three states:
 *
 *   CART      → Shows items, quantity controls, proceed to checkout
 *   CHECKOUT  → Shipping address form + Stripe Payment Element
 *   SUCCESS   → Order confirmation (redirected here from Stripe)
 *
 * Flow:
 *   1. Consumer browses /shop → adds items to cart
 *   2. Cart page shows items → "Proceed to checkout"
 *   3. Shipping form → POST /api/v1/retail/checkout → Stripe PaymentIntent
 *   4. Stripe Payment Element → stripe.confirmPayment()
 *   5. Stripe redirects to /cart?payment_intent=xxx&order_id=xxx&redirect_status=succeeded
 *   6. Success page calls POST /api/v1/retail/orders/:orderId/confirm
 *   7. Confirmation screen with order details and link to /orders
 *
 * Architecture:
 * - Single page component with local state machine (cart → checkout → success)
 * - Cart data fetched from API and kept in sync on every mutation
 * - StripeProvider wraps checkout step only (lazy-loaded)
 * - Stripe redirect success handled via URL search params
 *
 * Design:
 * - Two-column layout on desktop (items left, summary right)
 * - Single column on mobile
 * - Matches Loocbooc design tokens throughout
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// Stripe singleton — created outside component to be stable across renders
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  coverImageUrl: string | null;
  brandName: string;
  colour: string | null;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  currency: string;
  isAvailable: boolean;
  stock: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
  estimatedShippingCents: number;
  estimatedTaxCents: number;
  estimatedTotalCents: number;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
}

interface CheckoutSession {
  orderId: string;
  clientSecret: string;
  totalCents: number;
  currency: string;
}

interface OrderConfirmation {
  id: string;
  status: string;
  brandName: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

type PageState =
  | "loading"
  | "empty"
  | "cart"
  | "checkout"
  | "payment"
  | "confirming"
  | "success"
  | "payment_failed"
  | "error";

const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postcode: "",
  country: "AU",
  phone: "",
};

const AU_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "WA", label: "Western Australia" },
  { value: "SA", label: "South Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "ACT", label: "Australian Capital Territory" },
  { value: "NT", label: "Northern Territory" },
];

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
// Stripe appearance theme
// ─────────────────────────────────────────────

const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#111111",
    colorBackground: "#ffffff",
    colorText: "#111111",
    colorDanger: "#ef4444",
    colorTextSecondary: "#6b7280",
    colorTextPlaceholder: "#9ca3af",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSizeSm: "13px",
    fontSizeBase: "15px",
    spacingUnit: "4px",
    borderRadius: "8px",
    gridRowSpacing: "16px",
    gridColumnSpacing: "16px",
  },
  rules: {
    ".Input": {
      border: "1px solid #e5e7eb",
      boxShadow: "none",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid #111111",
      outline: "none",
      boxShadow: "none",
    },
    ".Input--invalid": {
      border: "1px solid #ef4444",
      boxShadow: "none",
    },
    ".Label": {
      fontWeight: "500",
      fontSize: "13px",
      marginBottom: "6px",
      color: "#374151",
    },
    ".Error": {
      fontSize: "12px",
      marginTop: "4px",
      color: "#ef4444",
    },
  },
};

// ─────────────────────────────────────────────
// Stripe Payment Form (inner component — needs Elements context)
// ─────────────────────────────────────────────

interface PaymentFormProps {
  orderId: string;
  totalCents: number;
  currency: string;
  onSuccess: (confirmation: OrderConfirmation) => void;
  onError: (msg: string) => void;
}

function PaymentForm({ orderId, totalCents, currency, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMsg(null);

    // Submit elements first (validates the form)
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMsg(submitError.message ?? "Payment validation failed.");
      setProcessing(false);
      return;
    }

    // Confirm the payment — Stripe will redirect on success
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/cart?order_id=${orderId}&redirect_status=succeeded`,
      },
    });

    // Only reaches here if redirect didn't happen (error case)
    if (error) {
      const msg = error.type === "card_error" || error.type === "validation_error"
        ? (error.message ?? "Payment failed. Please try again.")
        : "Something went wrong. Please try again or use a different payment method.";
      setErrorMsg(msg);
      onError(msg);
    }

    setProcessing(false);
  }, [stripe, elements, orderId, onError]);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "24px" }}>
        <PaymentElement
          options={{
            layout: "tabs",
            fields: {
              billingDetails: {
                address: "auto",
              },
            },
          }}
        />
      </div>

      {errorMsg && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          fontSize: "14px",
          color: "#dc2626",
        }}>
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          width: "100%",
          padding: "16px",
          background: processing ? "#6b7280" : "#111111",
          color: "#fff",
          border: "none",
          borderRadius: "12px",
          fontSize: "15px",
          fontWeight: "600",
          cursor: processing ? "not-allowed" : "pointer",
          transition: "background 150ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {processing ? (
          <>
            <span style={{
              display: "inline-block",
              width: "16px",
              height: "16px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "looc-spin 0.7s linear infinite",
            }} />
            Processing…
          </>
        ) : (
          `Pay ${formatPrice(totalCents, currency)}`
        )}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Quantity stepper
// ─────────────────────────────────────────────

interface QtyStepperProps {
  value: number;
  max: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
}

function QtyStepper({ value, max, onChange, disabled }: QtyStepperProps) {
  const btnStyle = (isDisabled: boolean): React.CSSProperties => ({
    width: "32px",
    height: "32px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: isDisabled ? "#f9fafb" : "#fff",
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: "18px",
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: isDisabled ? "#d1d5db" : "#374151",
    transition: "background 150ms, border-color 150ms",
    flexShrink: 0,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 1}
        style={btnStyle(disabled || value <= 1)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span style={{ minWidth: "24px", textAlign: "center", fontSize: "14px", fontWeight: "500" }}>
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        style={btnStyle(disabled || value >= max)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Cart item row
// ─────────────────────────────────────────────

interface CartItemRowProps {
  item: CartItem;
  onUpdateQty: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
  updating: boolean;
}

function CartItemRow({ item, onUpdateQty, onRemove, updating }: CartItemRowProps) {
  const variantLabel = [item.colour, item.size].filter(Boolean).join(" · ");

  return (
    <div style={{
      display: "flex",
      gap: "16px",
      padding: "20px 0",
      borderBottom: "1px solid var(--border-default, #f0f0f0)",
      opacity: updating ? 0.5 : 1,
      transition: "opacity 200ms ease",
    }}>
      {/* Thumbnail */}
      <div style={{
        width: "80px",
        height: "96px",
        borderRadius: "8px",
        background: "#f5f5f5",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt={item.productName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
          }}>
            👗
          </div>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: "2px" }}>
          <span style={{ fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {item.brandName}
          </span>
        </div>
        <Link href={`/shop/${item.productSlug}`} style={{
          fontSize: "15px",
          fontWeight: "500",
          color: "var(--loocbooc-black, #111)",
          textDecoration: "none",
          lineHeight: "1.3",
          display: "block",
          marginBottom: "4px",
        }}>
          {item.productName}
        </Link>
        {variantLabel && (
          <p style={{ fontSize: "13px", color: "#666", margin: "0 0 12px" }}>{variantLabel}</p>
        )}

        {/* Low stock warning */}
        {item.isAvailable && item.stock > 0 && item.stock <= 3 && (
          <p style={{ fontSize: "12px", color: "#f59e0b", margin: "0 0 8px" }}>
            Only {item.stock} left
          </p>
        )}

        {/* Out of stock warning */}
        {!item.isAvailable && (
          <p style={{ fontSize: "12px", color: "#ef4444", margin: "0 0 8px" }}>
            Out of stock — remove to continue
          </p>
        )}

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <QtyStepper
            value={item.quantity}
            max={Math.min(item.stock, 10)}
            onChange={(qty) => {
              if (qty === 0) onRemove(item.id);
              else onUpdateQty(item.id, qty);
            }}
            disabled={updating || !item.isAvailable}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => onRemove(item.id)}
              disabled={updating}
              style={{
                background: "none",
                border: "none",
                color: "#9ca3af",
                fontSize: "13px",
                cursor: "pointer",
                padding: "0",
                textDecoration: "underline",
              }}
            >
              Remove
            </button>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>
              {formatPrice(item.totalCents, item.currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Order summary panel
// ─────────────────────────────────────────────

interface OrderSummaryProps {
  cart: Cart;
  onCheckout: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function OrderSummary({ cart, onCheckout, loading, disabled }: OrderSummaryProps) {
  const hasUnavailable = cart.items.some((i) => !i.isAvailable);

  return (
    <div style={{
      background: "#fafafa",
      borderRadius: "12px",
      border: "1px solid #f0f0f0",
      padding: "24px",
      position: "sticky",
      top: "24px",
    }}>
      <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 20px", color: "#111" }}>
        Order summary
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
          <span style={{ color: "#666" }}>Subtotal ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})</span>
          <span style={{ fontWeight: "500" }}>{formatPrice(cart.subtotalCents, cart.currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
          <span style={{ color: "#666" }}>Shipping</span>
          <span style={{ fontWeight: "500", color: cart.estimatedShippingCents === 0 ? "#16a34a" : "#111" }}>
            {cart.estimatedShippingCents === 0 ? "Free" : formatPrice(cart.estimatedShippingCents, cart.currency)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
          <span style={{ color: "#666" }}>GST (10%)</span>
          <span style={{ fontWeight: "500" }}>{formatPrice(cart.estimatedTaxCents, cart.currency)}</span>
        </div>
        <div style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: "12px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "16px",
          fontWeight: "700",
        }}>
          <span>Total</span>
          <span>{formatPrice(cart.estimatedTotalCents, cart.currency)}</span>
        </div>
      </div>

      {hasUnavailable && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#dc2626",
        }}>
          Remove out-of-stock items before checking out.
        </div>
      )}

      <button
        onClick={onCheckout}
        disabled={disabled || loading || hasUnavailable || cart.items.length === 0}
        style={{
          width: "100%",
          padding: "14px",
          background: disabled || hasUnavailable ? "#d1d5db" : "#111111",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "15px",
          fontWeight: "600",
          cursor: disabled || hasUnavailable ? "not-allowed" : "pointer",
          transition: "background 150ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {loading ? (
          <>
            <span style={{
              display: "inline-block",
              width: "16px",
              height: "16px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "looc-spin 0.7s linear infinite",
            }} />
            Loading…
          </>
        ) : "Proceed to checkout"}
      </button>

      <p style={{ fontSize: "12px", color: "#9ca3af", textAlign: "center", margin: "12px 0 0" }}>
        Secure checkout via Stripe. Free returns within 30 days.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shipping form
// ─────────────────────────────────────────────

interface ShippingFormProps {
  address: ShippingAddress;
  onChange: (address: ShippingAddress) => void;
  onSubmit: () => void;
  loading: boolean;
  onBack: () => void;
}

function ShippingForm({ address, onChange, onSubmit, loading, onBack }: ShippingFormProps) {
  const set = (field: keyof ShippingAddress) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => onChange({ ...address, [field]: e.target.value });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    color: "#111",
    background: "#fff",
    boxSizing: "border-box",
    transition: "border-color 150ms ease",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "6px",
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: "16px",
  };

  const isValid =
    address.firstName.trim() &&
    address.lastName.trim() &&
    address.line1.trim() &&
    address.city.trim() &&
    address.state.trim() &&
    address.postcode.trim() &&
    address.country.trim();

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "#666",
          fontSize: "14px",
          cursor: "pointer",
          padding: "0 0 20px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ← Back to cart
      </button>

      <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 24px", color: "#111" }}>
        Shipping address
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>First name</label>
          <input
            style={inputStyle}
            value={address.firstName}
            onChange={set("firstName")}
            placeholder="Jane"
            autoComplete="given-name"
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Last name</label>
          <input
            style={inputStyle}
            value={address.lastName}
            onChange={set("lastName")}
            placeholder="Smith"
            autoComplete="family-name"
          />
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Address line 1</label>
        <input
          style={inputStyle}
          value={address.line1}
          onChange={set("line1")}
          placeholder="123 Example Street"
          autoComplete="address-line1"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Address line 2 <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
        <input
          style={inputStyle}
          value={address.line2}
          onChange={set("line2")}
          placeholder="Apartment, suite, unit…"
          autoComplete="address-line2"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>City</label>
          <input
            style={inputStyle}
            value={address.city}
            onChange={set("city")}
            placeholder="Brisbane"
            autoComplete="address-level2"
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>State</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={address.state}
            onChange={set("state")}
            autoComplete="address-level1"
          >
            <option value="">Select state…</option>
            {AU_STATES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Postcode</label>
          <input
            style={inputStyle}
            value={address.postcode}
            onChange={set("postcode")}
            placeholder="4000"
            autoComplete="postal-code"
            maxLength={10}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Country</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={address.country}
            onChange={set("country")}
            autoComplete="country"
          >
            <option value="AU">Australia</option>
            <option value="NZ">New Zealand</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
          </select>
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Phone <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional, for delivery updates)</span></label>
        <input
          style={inputStyle}
          type="tel"
          value={address.phone}
          onChange={set("phone")}
          placeholder="+61 400 000 000"
          autoComplete="tel"
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={!isValid || loading}
        style={{
          width: "100%",
          marginTop: "8px",
          padding: "14px",
          background: !isValid || loading ? "#d1d5db" : "#111111",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "15px",
          fontWeight: "600",
          cursor: !isValid || loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "background 150ms ease",
        }}
      >
        {loading ? (
          <>
            <span style={{
              display: "inline-block",
              width: "16px",
              height: "16px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "looc-spin 0.7s linear infinite",
            }} />
            Preparing payment…
          </>
        ) : "Continue to payment"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Success screen
// ─────────────────────────────────────────────

interface SuccessScreenProps {
  order: OrderConfirmation;
}

function SuccessScreen({ order }: SuccessScreenProps) {
  return (
    <div style={{ textAlign: "center", maxWidth: "480px", margin: "0 auto", padding: "40px 0" }}>
      <div style={{
        width: "72px",
        height: "72px",
        background: "#f0fdf4",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 24px",
        fontSize: "32px",
      }}>
        ✅
      </div>

      <h1 style={{
        fontFamily: "'DM Serif Display', 'Georgia', serif",
        fontSize: "32px",
        fontWeight: "400",
        margin: "0 0 12px",
        color: "#111",
      }}>
        Order confirmed
      </h1>

      <p style={{ fontSize: "15px", color: "#666", lineHeight: "1.6", margin: "0 0 32px" }}>
        Your order from {order.brandName} is confirmed. You'll receive a confirmation email shortly.
      </p>

      <div style={{
        background: "#f9fafb",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "32px",
        textAlign: "left",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", padding: "6px 0" }}>
          <span style={{ color: "#666" }}>Order ID</span>
          <span style={{ fontFamily: "monospace", fontSize: "13px" }}>{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", padding: "6px 0" }}>
          <span style={{ color: "#666" }}>Items</span>
          <span style={{ fontWeight: "500" }}>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", padding: "6px 0" }}>
          <span style={{ color: "#666" }}>Total paid</span>
          <span style={{ fontWeight: "700" }}>{formatPrice(order.totalCents, order.currency)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/orders" style={{
          padding: "12px 24px",
          background: "#111",
          color: "#fff",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "600",
          textDecoration: "none",
        }}>
          View my orders
        </Link>
        <Link href="/shop" style={{
          padding: "12px 24px",
          background: "#f5f5f5",
          color: "#111",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "600",
          textDecoration: "none",
        }}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────

export default function CartPage() {
  const searchParams = useSearchParams();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [cart, setCart] = useState<Cart | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // ── Auth check ───────────────────────────────────────────────────────────

  const token = useMemo(() => getAuthToken(), []);

  // ── Handle Stripe redirect return ──────────────────────────────────────

  useEffect(() => {
    const redirectStatus = searchParams.get("redirect_status");
    const orderId = searchParams.get("order_id");

    if (!redirectStatus || !orderId) return;

    if (redirectStatus === "succeeded") {
      setPageState("confirming");

      const confirmOrder = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/retail/orders/${orderId}/confirm`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ orderId, paymentIntentId: searchParams.get("payment_intent") ?? "" }),
          });

          if (!res.ok) {
            const json = (await res.json()) as { error?: { message?: string } };
            throw new Error(json.error?.message ?? "Order confirmation failed");
          }

          const json = (await res.json()) as { data: OrderConfirmation };
          setOrder(json.data);
          setPageState("success");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not confirm your order. Please contact support.");
          setPageState("error");
        }
      };

      void confirmOrder();
    } else if (redirectStatus === "failed" || redirectStatus === "canceled") {
      setPageState("payment_failed");
    }
  }, [searchParams, token]);

  // ── Fetch cart ────────────────────────────────────────────────────────

  const fetchCart = useCallback(async () => {
    if (!token) {
      setPageState("cart"); // Will show sign-in CTA
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load cart");

      const json = (await res.json()) as { data: Cart };
      const cartData = json.data;
      setCart(cartData);
      setPageState(cartData.items.length === 0 ? "empty" : "cart");
    } catch {
      setError("Could not load your cart. Please refresh.");
      setPageState("error");
    }
  }, [token]);

  // Only fetch cart if we're not handling a Stripe redirect
  useEffect(() => {
    const redirectStatus = searchParams.get("redirect_status");
    if (!redirectStatus) {
      void fetchCart();
    }
  }, [fetchCart, searchParams]);

  // ── Cart mutations ────────────────────────────────────────────────────

  const updateQuantity = useCallback(async (itemId: string, qty: number) => {
    if (!token || !cart) return;
    setUpdatingItemId(itemId);

    try {
      const res = await fetch(`${API_BASE}/api/v1/cart/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: qty }),
      });

      if (!res.ok) throw new Error("Update failed");
      await fetchCart();
    } catch {
      // Silently refresh — the UI state will self-correct
      await fetchCart();
    } finally {
      setUpdatingItemId(null);
    }
  }, [token, cart, fetchCart]);

  const removeItem = useCallback(async (itemId: string) => {
    if (!token) return;
    setUpdatingItemId(itemId);

    try {
      await fetch(`${API_BASE}/api/v1/cart/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: 0 }),
      });
      await fetchCart();
    } catch {
      await fetchCart();
    } finally {
      setUpdatingItemId(null);
    }
  }, [token, fetchCart]);

  // ── Checkout flow ────────────────────────────────────────────────────

  const handleProceedToCheckout = useCallback(() => {
    if (!token) {
      // Redirect to login
      window.location.href = `/login?next=${encodeURIComponent("/cart")}`;
      return;
    }
    setPageState("checkout");
  }, [token]);

  const handleSubmitShipping = useCallback(async () => {
    if (!cart || !token) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/retail/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cartId: cart.id,
          shippingAddress: {
            firstName: address.firstName,
            lastName: address.lastName,
            line1: address.line1,
            line2: address.line2 || undefined,
            city: address.city,
            state: address.state,
            postcode: address.postcode,
            country: address.country,
            phone: address.phone || undefined,
          },
        }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "Could not start checkout");
      }

      const json = (await res.json()) as { data: CheckoutSession };
      setCheckoutSession(json.data);
      setPageState("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }, [cart, token, address]);

  // ── Render ────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "32px 24px 80px",
    minHeight: "60vh",
  };

  // Spin keyframes (injected once)
  const spinStyle = (
    <style>{`
      @keyframes looc-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  );

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (!token && pageState === "cart") {
    return (
      <div style={containerStyle}>
        {spinStyle}
        <div style={{ textAlign: "center", padding: "80px 0", maxWidth: "360px", margin: "0 auto" }}>
          <p style={{ fontSize: "40px", marginBottom: "16px" }}>🛒</p>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 12px", color: "#111" }}>
            Your cart
          </h1>
          <p style={{ color: "#666", marginBottom: "24px", lineHeight: "1.6" }}>
            Sign in to see your cart and check out.
          </p>
          <Link href={`/login?next=${encodeURIComponent("/cart")}`} style={{
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
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div style={containerStyle}>
        {spinStyle}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: "120px",
              borderRadius: "12px",
              background: "linear-gradient(90deg, #f5f5f5 25%, #ececec 50%, #f5f5f5 75%)",
              backgroundSize: "200% 100%",
              animation: "looc-shimmer 1.4s infinite ease-in-out",
            }} />
          ))}
        </div>
        <style>{`
          @keyframes looc-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  // ── Confirming order ──────────────────────────────────────────────────
  if (pageState === "confirming") {
    return (
      <div style={{ ...containerStyle, textAlign: "center", paddingTop: "80px" }}>
        {spinStyle}
        <div style={{
          display: "inline-block",
          width: "40px",
          height: "40px",
          border: "3px solid #e5e7eb",
          borderTopColor: "#111",
          borderRadius: "50%",
          animation: "looc-spin 0.8s linear infinite",
          marginBottom: "20px",
        }} />
        <p style={{ color: "#666", fontSize: "15px" }}>Confirming your order…</p>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────
  if (pageState === "success" && order) {
    return (
      <div style={containerStyle}>
        {spinStyle}
        <SuccessScreen order={order} />
      </div>
    );
  }

  // ── Payment failed ────────────────────────────────────────────────────
  if (pageState === "payment_failed") {
    return (
      <div style={{ ...containerStyle, textAlign: "center", paddingTop: "60px" }}>
        {spinStyle}
        <p style={{ fontSize: "40px", marginBottom: "16px" }}>❌</p>
        <h2 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 12px" }}>Payment failed</h2>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          Your payment didn't go through. No charge was made.
        </p>
        <button
          onClick={() => {
            // Remove redirect params and go back to cart
            window.history.replaceState({}, "", "/cart");
            void fetchCart();
          }}
          style={{
            padding: "12px 28px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Back to cart
        </button>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (pageState === "error") {
    return (
      <div style={{ ...containerStyle, textAlign: "center", paddingTop: "60px" }}>
        {spinStyle}
        <p style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</p>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 12px" }}>Something went wrong</h2>
        <p style={{ color: "#666", marginBottom: "24px" }}>{error ?? "An unexpected error occurred."}</p>
        <button
          onClick={() => void fetchCart()}
          style={{
            padding: "12px 28px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Empty cart ────────────────────────────────────────────────────────
  if (pageState === "empty" || (pageState === "cart" && cart && cart.items.length === 0)) {
    return (
      <div style={{ ...containerStyle, textAlign: "center", paddingTop: "80px" }}>
        {spinStyle}
        <p style={{ fontSize: "48px", marginBottom: "20px" }}>🛒</p>
        <h1 style={{
          fontFamily: "'DM Serif Display', 'Georgia', serif",
          fontSize: "28px",
          fontWeight: "400",
          margin: "0 0 12px",
          color: "#111",
        }}>
          Your cart is empty
        </h1>
        <p style={{ color: "#666", marginBottom: "32px", fontSize: "15px" }}>
          Nothing here yet. Head to the shop to find something you'll love.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/shop" style={{
            padding: "12px 28px",
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
            padding: "12px 28px",
            background: "#f5f5f5",
            color: "#111",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            textDecoration: "none",
          }}>
            Explore campaigns
          </Link>
        </div>
      </div>
    );
  }

  // ── Checkout (shipping address) ────────────────────────────────────────
  if (pageState === "checkout") {
    return (
      <div style={containerStyle}>
        {spinStyle}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px", maxWidth: "560px" }}>
          <ShippingForm
            address={address}
            onChange={setAddress}
            onSubmit={() => void handleSubmitShipping()}
            loading={checkoutLoading}
            onBack={() => setPageState("cart")}
          />
          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              padding: "12px 16px",
              fontSize: "14px",
              color: "#dc2626",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Payment (Stripe Elements) ─────────────────────────────────────────
  if (pageState === "payment" && checkoutSession) {
    return (
      <div style={containerStyle}>
        {spinStyle}
        <div style={{ maxWidth: "560px" }}>
          <button
            onClick={() => setPageState("checkout")}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: "14px",
              cursor: "pointer",
              padding: "0 0 20px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ← Edit shipping address
          </button>

          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px", color: "#111" }}>
            Payment
          </h2>

          {/* Order total reminder */}
          <div style={{
            background: "#f9fafb",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
          }}>
            <span style={{ color: "#666" }}>Total due today</span>
            <span style={{ fontWeight: "700" }}>
              {formatPrice(checkoutSession.totalCents, checkoutSession.currency)}
            </span>
          </div>

          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: checkoutSession.clientSecret,
              appearance: STRIPE_APPEARANCE,
              loader: "auto",
            }}
          >
            <PaymentForm
              orderId={checkoutSession.orderId}
              totalCents={checkoutSession.totalCents}
              currency={checkoutSession.currency}
              onSuccess={(confirmation) => {
                setOrder(confirmation);
                setPageState("success");
              }}
              onError={(msg) => setError(msg)}
            />
          </Elements>
        </div>
      </div>
    );
  }

  // ── Cart (main view) ──────────────────────────────────────────────────
  if (!cart) return null;

  return (
    <div style={containerStyle}>
      {spinStyle}
      <h1 style={{
        fontFamily: "'DM Serif Display', 'Georgia', serif",
        fontSize: "32px",
        fontWeight: "400",
        margin: "0 0 32px",
        color: "#111",
      }}>
        Your cart
        <span style={{ fontSize: "16px", fontWeight: "400", fontFamily: "Inter, sans-serif", color: "#999", marginLeft: "12px" }}>
          ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
        </span>
      </h1>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr min(340px, 35%)",
        gap: "48px",
        alignItems: "start",
      }}>
        {/* Item list */}
        <div>
          {cart.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQty={(id, qty) => void updateQuantity(id, qty)}
              onRemove={(id) => void removeItem(id)}
              updating={updatingItemId === item.id}
            />
          ))}

          {/* Continue shopping */}
          <div style={{ paddingTop: "24px" }}>
            <Link href="/shop" style={{
              fontSize: "14px",
              color: "#666",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}>
              ← Continue shopping
            </Link>
          </div>
        </div>

        {/* Summary */}
        <OrderSummary
          cart={cart}
          onCheckout={handleProceedToCheckout}
          loading={checkoutLoading}
        />
      </div>

      {/* Responsive: on small screens, summary goes below the list */}
      <style>{`
        @media (max-width: 768px) {
          /* The grid auto-adjusts because min() clamps to 35% */
        }
      `}</style>
    </div>
  );
}
