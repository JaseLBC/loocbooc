/**
 * Backing form — Consumer-facing campaign checkout.
 *
 * Full Stripe Payment Element integration. SCA / 3DS compliant.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  STEP 1: Size selection                                  │
 * │  STEP 2: Shipping address                                │
 * │  STEP 3: Payment (Stripe Payment Element)                │
 * └──────────────────────────────────────────────────────────┘
 *
 * Flow:
 *   1. User selects size (Step 1) → Continue
 *   2. User fills shipping address (Step 2) → Continue to Payment
 *   3. Client calls POST /create-payment-intent → receives client_secret
 *   4. Stripe Payment Element mounts with client_secret
 *   5. User enters card → clicks "Back It"
 *   6. stripe.confirmPayment() → Stripe handles 3DS / redirect
 *   7. Stripe redirects to /back/:campaignId/success?payment_intent=xxx
 *   8. Success page calls /confirm-backing → records in DB
 *
 * Design: clean multi-step with animated step transitions.
 * Matches Loocbooc design tokens throughout.
 */

"use client";

import { useState, useCallback } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { StripeProvider } from "./StripeProvider";
import type { SizeBreak } from "../../../../packages/types/src";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "AU",
  phone: "",
};

export interface BackingFormProps {
  campaignId: string;
  availableSizes: string[];
  sizeBreaks: SizeBreak[];
  sizeLimits: Record<string, number> | null;
  backerPriceCents: number;
  currency: string;
}

type Step = "size" | "address" | "payment";

// ─────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "size",    label: "Size" },
    { key: "address", label: "Shipping" },
    { key: "payment", label: "Payment" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Dot */}
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0
              transition-all duration-200
              ${done   ? "bg-[#22C55E] text-white"
              : active ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
              :           "bg-[var(--surface-2)] text-[var(--text-tertiary)]"}
            `}>
              {done ? "✓" : idx + 1}
            </div>
            {/* Label */}
            <span className={`
              ml-2 text-xs font-medium
              ${active ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}
            `}>
              {step.label}
            </span>
            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div className={`
                flex-1 mx-3 h-px transition-all duration-300
                ${idx < currentIdx ? "bg-[#22C55E]" : "bg-[var(--surface-3)]"}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1: Size selector
// ─────────────────────────────────────────────

function SizeStep({
  availableSizes,
  sizeBreaks,
  sizeLimits,
  selectedSize,
  onSelect,
  onContinue,
  backerPriceCents,
  currency,
}: {
  availableSizes: string[];
  sizeBreaks: SizeBreak[];
  sizeLimits: Record<string, number> | null;
  selectedSize: string | null;
  onSelect: (size: string) => void;
  onContinue: () => void;
  backerPriceCents: number;
  currency: string;
}) {
  const sizeBreakMap = new Map(sizeBreaks.map((sb) => [sb.size, sb.backingCount]));

  function getSizeStatus(size: string): "available" | "limited" | "sold-out" {
    const limit = sizeLimits?.[size];
    if (!limit) return "available";
    const count = sizeBreakMap.get(size) ?? 0;
    if (count >= limit) return "sold-out";
    if (count >= limit * 0.9) return "limited";
    return "available";
  }

  return (
    <div>
      <h3 className="font-semibold text-[var(--text-primary)] mb-1">Select your size</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        {currency} {(backerPriceCents / 100).toFixed(2)} per item. Full refund if the campaign doesn&apos;t reach its goal.
      </p>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {availableSizes.map((size) => {
          const status = getSizeStatus(size);
          const isSoldOut = status === "sold-out";
          const isLimited = status === "limited";
          const isSelected = selectedSize === size;
          const count = sizeBreakMap.get(size);

          return (
            <button
              key={size}
              type="button"
              onClick={() => !isSoldOut && onSelect(size)}
              disabled={isSoldOut}
              aria-pressed={isSelected}
              className={`
                relative flex flex-col items-center gap-0.5 py-3.5 px-2 rounded-[var(--radius-lg)]
                border-2 transition-all duration-[var(--duration-fast)] text-sm font-semibold
                ${isSelected
                  ? "border-[var(--loocbooc-black)] bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
                  : isSoldOut
                  ? "border-[var(--surface-3)] bg-[var(--surface-2)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50"
                  : "border-[var(--surface-3)] bg-[var(--surface-1)] text-[var(--text-primary)] hover:border-[var(--loocbooc-black)] hover:shadow-[var(--shadow-1)]"
                }
              `}
            >
              <span>{size}</span>
              {isLimited && !isSelected && (
                <span className="text-[9px] font-medium text-orange-500 uppercase tracking-wide leading-none">
                  Few left
                </span>
              )}
              {isSoldOut && (
                <span className="text-[9px] font-medium uppercase tracking-wide leading-none">
                  Sold out
                </span>
              )}
              {!isSoldOut && !isLimited && count !== undefined && count > 0 && (
                <span className={`text-[9px] leading-none ${isSelected ? "text-white/70" : "text-[var(--text-tertiary)]"}`}>
                  {count} backers
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!selectedSize}
        className="
          w-full py-3.5 rounded-[var(--radius-md)] bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]
          font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
          transition-opacity
        "
      >
        Continue
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2: Shipping address
// ─────────────────────────────────────────────

const COUNTRIES = [
  { value: "AU", label: "Australia" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "NZ", label: "New Zealand" },
  { value: "CA", label: "Canada" },
  { value: "SG", label: "Singapore" },
  { value: "JP", label: "Japan" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
];

function AddressStep({
  address,
  onChange,
  onContinue,
  onBack,
  loading,
  error,
}: {
  address: ShippingAddress;
  onChange: (field: keyof ShippingAddress, value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const inputClass = `
    w-full px-3.5 py-3 rounded-[var(--radius-md)] border border-[var(--surface-3)]
    bg-[var(--surface-1)] text-[var(--text-primary)] text-sm
    placeholder:text-[var(--text-tertiary)]
    focus:outline-none focus:border-[var(--loocbooc-black)] focus:ring-0
    transition-colors
  `;
  const labelClass = "block text-xs font-medium text-[var(--text-secondary)] mb-1.5";

  const isValid = !!(
    address.firstName &&
    address.lastName &&
    address.address1 &&
    address.city &&
    address.state &&
    address.postalCode &&
    address.country
  );

  return (
    <div>
      <h3 className="font-semibold text-[var(--text-primary)] mb-1">Shipping address</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        Where should we ship your order?
      </p>

      <div className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First name *</label>
            <input
              type="text"
              value={address.firstName}
              onChange={(e) => onChange("firstName", e.target.value)}
              placeholder="Jane"
              autoComplete="given-name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Last name *</label>
            <input
              type="text"
              value={address.lastName}
              onChange={(e) => onChange("lastName", e.target.value)}
              placeholder="Smith"
              autoComplete="family-name"
              className={inputClass}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className={labelClass}>Address line 1 *</label>
          <input
            type="text"
            value={address.address1}
            onChange={(e) => onChange("address1", e.target.value)}
            placeholder="123 Main Street"
            autoComplete="address-line1"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Apartment, suite, etc. (optional)</label>
          <input
            type="text"
            value={address.address2}
            onChange={(e) => onChange("address2", e.target.value)}
            placeholder="Apt 4B"
            autoComplete="address-line2"
            className={inputClass}
          />
        </div>

        {/* City + State */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>City *</label>
            <input
              type="text"
              value={address.city}
              onChange={(e) => onChange("city", e.target.value)}
              placeholder="Sydney"
              autoComplete="address-level2"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>State / Province *</label>
            <input
              type="text"
              value={address.state}
              onChange={(e) => onChange("state", e.target.value)}
              placeholder="NSW"
              autoComplete="address-level1"
              className={inputClass}
            />
          </div>
        </div>

        {/* Postcode + Country */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Postcode *</label>
            <input
              type="text"
              value={address.postalCode}
              onChange={(e) => onChange("postalCode", e.target.value)}
              placeholder="2000"
              autoComplete="postal-code"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Country *</label>
            <select
              value={address.country}
              onChange={(e) => onChange("country", e.target.value)}
              autoComplete="country"
              className={inputClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className={labelClass}>Phone (optional)</label>
          <input
            type="tel"
            value={address.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="+61 4XX XXX XXX"
            autoComplete="tel"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-[var(--radius-md)] text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-[var(--radius-md)] border border-[var(--surface-3)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!isValid || loading}
          className="flex-[2] py-3 rounded-[var(--radius-md)] bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading payment…
            </span>
          ) : "Continue to Payment"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3: Payment (Stripe Payment Element)
// Inner component — must be inside <Elements> context
// ─────────────────────────────────────────────

interface PaymentStepInnerProps {
  campaignId: string;
  selectedSize: string;
  backerPriceCents: number;
  depositCents: number;
  currency: string;
  onBack: () => void;
}

function PaymentStepInner({
  campaignId,
  selectedSize,
  backerPriceCents,
  depositCents,
  currency,
  onBack,
}: PaymentStepInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [elementsReady, setElementsReady] = useState(false);

  // Build the return URL with the campaign context
  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/back/${campaignId}/success`
    : `/back/${campaignId}/success`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    setPayError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      // redirect: 'always' ensures consistent flow — Stripe always redirects
      // to return_url where the success page handles backing confirmation.
      redirect: "always",
    });

    // If we get here, confirmPayment encountered an error BEFORE redirecting
    // (e.g., card declined, network error). Redirect errors don't reach here.
    setPaying(false);
    setPayError(error.message ?? "Payment failed. Please try again.");
  };

  return (
    <div>
      <h3 className="font-semibold text-[var(--text-primary)] mb-1">Payment</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-2">
        Secure payment powered by Stripe.
      </p>

      {/* Order summary */}
      <div className="bg-[var(--surface-2)] rounded-[var(--radius-md)] px-4 py-3 mb-6 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Size</span>
          <span className="font-medium text-[var(--text-primary)]">{selectedSize}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Campaign price</span>
          <span className="font-medium text-[var(--text-primary)]">
            {currency} {(backerPriceCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--surface-3)] mt-1.5">
          <span className="font-semibold text-[var(--text-primary)]">Total charged now</span>
          <span className="font-bold text-[var(--text-primary)]">
            {currency} {(depositCents / 100).toFixed(2)}
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] leading-snug pt-0.5">
          Fully refunded automatically if the campaign doesn't reach its goal.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Stripe Payment Element */}
        <div className={`transition-opacity duration-300 ${elementsReady ? "opacity-100" : "opacity-0"}`}>
          <PaymentElement
            onReady={() => setElementsReady(true)}
            options={{
              layout: "tabs",
              defaultValues: { billingDetails: { address: { country: "AU" } } },
            }}
          />
        </div>
        {/* Loading skeleton while Stripe mounts */}
        {!elementsReady && (
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-[var(--surface-2)] rounded-[var(--radius-md)]" />
            <div className="h-12 bg-[var(--surface-2)] rounded-[var(--radius-md)]" />
          </div>
        )}

        {payError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-[var(--radius-md)] text-sm text-red-600">
            {payError}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onBack}
            disabled={paying}
            className="flex-1 py-3 rounded-[var(--radius-md)] border border-[var(--surface-3)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:opacity-40 transition-colors"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={!stripe || !elementsReady || paying}
            className="flex-[2] py-3.5 rounded-[var(--radius-md)] bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {paying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing…
              </span>
            ) : (
              `Back It — ${currency} ${(depositCents / 100).toFixed(2)}`
            )}
          </button>
        </div>

        <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-4 leading-snug">
          By backing you agree to our terms of service.{" "}
          Your card details are never stored on Loocbooc — handled securely by Stripe.
        </p>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3: Payment wrapper — provides Stripe context
// ─────────────────────────────────────────────

interface PaymentStepProps extends PaymentStepInnerProps {
  clientSecret: string;
}

function PaymentStep({ clientSecret, ...rest }: PaymentStepProps) {
  return (
    <StripeProvider clientSecret={clientSecret}>
      <PaymentStepInner {...rest} />
    </StripeProvider>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function BackingForm({
  campaignId,
  availableSizes,
  sizeBreaks,
  sizeLimits,
  backerPriceCents,
  currency,
}: BackingFormProps) {
  const [step, setStep] = useState<Step>("size");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);

  // Payment Intent state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [depositCents, setDepositCents] = useState<number>(backerPriceCents);
  const [piError, setPiError] = useState<string | null>(null);
  const [piLoading, setPiLoading] = useState(false);

  const handleAddressChange = useCallback((field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Create PaymentIntent when moving from address → payment
  const handleAddressContinue = useCallback(async () => {
    if (!selectedSize) return;

    setPiLoading(true);
    setPiError(null);

    try {
      const res = await fetch(`/api/back-it/campaigns/${campaignId}/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: selectedSize,
          quantity: 1,
          shippingAddress: {
            firstName: address.firstName,
            lastName: address.lastName,
            address1: address.address1,
            address2: address.address2 || undefined,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            phone: address.phone || undefined,
          },
        }),
      });

      const json = await res.json() as {
        data?: { clientSecret: string; depositCents: number; currency: string };
        error?: { message: string };
      };

      if (!res.ok || !json.data?.clientSecret) {
        throw new Error(json.error?.message ?? "Failed to prepare payment. Please try again.");
      }

      setClientSecret(json.data.clientSecret);
      setDepositCents(json.data.depositCents);
      setStep("payment");
    } catch (err) {
      setPiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPiLoading(false);
    }
  }, [campaignId, selectedSize, address]);

  return (
    <div className="backing-form-wrapper">
      <StepIndicator currentStep={step} />

      <div className="step-content">
        {step === "size" && (
          <SizeStep
            availableSizes={availableSizes}
            sizeBreaks={sizeBreaks}
            sizeLimits={sizeLimits}
            selectedSize={selectedSize}
            onSelect={setSelectedSize}
            onContinue={() => setStep("address")}
            backerPriceCents={backerPriceCents}
            currency={currency}
          />
        )}

        {step === "address" && (
          <AddressStep
            address={address}
            onChange={handleAddressChange}
            onContinue={handleAddressContinue}
            onBack={() => setStep("size")}
            loading={piLoading}
            error={piError}
          />
        )}

        {step === "payment" && clientSecret && selectedSize && (
          <PaymentStep
            clientSecret={clientSecret}
            campaignId={campaignId}
            selectedSize={selectedSize}
            backerPriceCents={backerPriceCents}
            depositCents={depositCents}
            currency={currency}
            onBack={() => {
              // Go back to address step and clear the PI (user may change details)
              setClientSecret(null);
              setStep("address");
            }}
          />
        )}
      </div>
    </div>
  );
}
