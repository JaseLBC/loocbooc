/**
 * Stripe Elements Provider — wraps the BackingForm payment step.
 *
 * Lazily loads Stripe.js (only loaded when the consumer reaches the payment step,
 * never on initial page load). Provides the Elements context with the
 * PaymentIntent client_secret.
 *
 * Design:
 * - loadStripe is called outside the component so the Stripe object is created
 *   once and stable across renders (Stripe's own recommendation).
 * - The Elements provider gets the clientSecret prop; Stripe infers the intent
 *   type and renders the appropriate payment form automatically.
 * - Appearance matches the Loocbooc design system tokens.
 */

"use client";

import { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

// ─────────────────────────────────────────────
// Stripe instance (stable singleton)
// ─────────────────────────────────────────────

// loadStripe is called at module level outside any React lifecycle — this is
// Stripe's recommended pattern to avoid re-creating the Stripe object.
const stripePromise = loadStripe(
  process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "",
);

// ─────────────────────────────────────────────
// Appearance theme
// ─────────────────────────────────────────────

// Matches Loocbooc design tokens — clean, minimal, high-contrast.
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
      transition: "border-color 150ms ease",
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
// Provider component
// ─────────────────────────────────────────────

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: STRIPE_APPEARANCE,
      loader: "auto" as const,
    }),
    [clientSecret],
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
