/**
 * New Campaign — /campaigns/new
 *
 * Multi-step wizard for creating a Back It campaign.
 *
 * Steps:
 *   1. DETAILS    — title, description, cover image URL, gallery images
 *   2. PRICING    — retail price, backer price, deposit percent, available sizes, MOQ, stretch goal
 *   3. TIMELINE   — start date, end date, estimated ship date, manufacturer ID (optional)
 *   4. REVIEW     — summary of all fields before submission
 *
 * On submit: POST /api/v1/back-it/campaigns → redirects to /campaigns/:id on success.
 *
 * All money values are stored as cents server-side.
 * The UI accepts dollars/floats and converts on submit.
 *
 * Note: Creating a campaign requires an existing garment ID. If the brand has
 * no garments, the wizard prompts them to create one first. For the MVP this form
 * also accepts a garment name (creating the garment inline) but that requires a
 * future garment creation endpoint — currently handled with a garment selector.
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Garment {
  id: string;
  name: string;
  category: string;
  styleCode: string | null;
}

type Step = "details" | "pricing" | "timeline" | "review";

interface FormData {
  // Step 1 — Details
  garmentId: string;
  title: string;
  description: string;
  coverImageUrl: string;
  galleryUrls: string;

  // Step 2 — Pricing & MOQ
  retailPrice: string;
  backerPrice: string;
  depositPercent: string;
  currency: string;
  moq: string;
  stretchGoalQty: string;
  availableSizes: string[];
  sizeLimitsEnabled: boolean;

  // Step 3 — Timeline
  campaignStart: string;
  campaignEnd: string;
  estimatedShipDate: string;
  manufacturerId: string;
}

const INITIAL_FORM: FormData = {
  garmentId: "",
  title: "",
  description: "",
  coverImageUrl: "",
  galleryUrls: "",
  retailPrice: "",
  backerPrice: "",
  depositPercent: "100",
  currency: "AUD",
  moq: "",
  stretchGoalQty: "",
  availableSizes: [],
  sizeLimitsEnabled: false,
  campaignStart: "",
  campaignEnd: "",
  estimatedShipDate: "",
  manufacturerId: "",
};

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: "details",  label: "Details",  icon: "📝" },
  { id: "pricing",  label: "Pricing",  icon: "💰" },
  { id: "timeline", label: "Timeline", icon: "📅" },
  { id: "review",   label: "Review",   icon: "✅" },
];

const STEP_ORDER: Step[] = ["details", "pricing", "timeline", "review"];

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "6", "8", "10", "12", "14", "16", "18", "20"];

const CURRENCY_OPTIONS = [
  { value: "AUD", label: "AUD (A$)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "NZD", label: "NZD (NZ$)" },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

function toCents(dollars: string): number {
  return Math.round(parseFloat(dollars) * 100);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

function formatCurrency(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

function validateStep(step: Step, form: FormData): string[] {
  const errors: string[] = [];

  if (step === "details") {
    if (!form.garmentId) errors.push("Select or create a garment for this campaign.");
    if (!form.title.trim()) errors.push("Campaign title is required.");
    if (form.title.length > 255) errors.push("Title must be under 255 characters.");
    if (!form.description.trim()) errors.push("Description is required.");
  }

  if (step === "pricing") {
    if (!form.retailPrice || isNaN(parseFloat(form.retailPrice))) errors.push("Enter a valid retail price.");
    if (!form.backerPrice || isNaN(parseFloat(form.backerPrice))) errors.push("Enter a valid backer price.");
    if (parseFloat(form.backerPrice) >= parseFloat(form.retailPrice)) {
      errors.push("Backer price must be less than the retail price.");
    }
    if (parseFloat(form.backerPrice) <= 0) errors.push("Backer price must be greater than zero.");
    if (!form.moq || isNaN(parseInt(form.moq)) || parseInt(form.moq) < 1) {
      errors.push("Enter a minimum order quantity of at least 1.");
    }
    if (form.availableSizes.length === 0) errors.push("Select at least one available size.");
    const deposit = parseInt(form.depositPercent);
    if (isNaN(deposit) || deposit < 1 || deposit > 100) {
      errors.push("Deposit percent must be between 1 and 100.");
    }
  }

  if (step === "timeline") {
    if (!form.campaignStart) errors.push("Campaign start date is required.");
    if (!form.campaignEnd) errors.push("Campaign end date is required.");
    if (form.campaignStart && form.campaignEnd) {
      if (new Date(form.campaignEnd) <= new Date(form.campaignStart)) {
        errors.push("Campaign end date must be after the start date.");
      }
    }
    if (form.estimatedShipDate && form.campaignEnd) {
      if (new Date(form.estimatedShipDate) <= new Date(form.campaignEnd)) {
        errors.push("Estimated ship date should be after the campaign end date.");
      }
    }
  }

  return errors;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((step, idx) => {
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isUpcoming = idx > currentIdx;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${isComplete ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]" : ""}
                ${isCurrent ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]" : ""}
                ${isUpcoming ? "bg-[var(--surface-2)] text-[var(--text-tertiary)]" : ""}
              `}>
                {isComplete ? "✓" : (idx + 1).toString()}
              </div>
              <span className={`text-sm font-medium ${isCurrent ? "text-[var(--text-primary)]" : isUpcoming ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-4 ${isComplete ? "bg-[var(--loocbooc-black)]" : "bg-[var(--surface-3)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

const inputClass = `
  w-full px-3 py-2.5 bg-[var(--surface-1)] border border-[var(--surface-3)]
  rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
  placeholder:text-[var(--text-tertiary)]
  focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-black)] focus:border-transparent
  transition-shadow
`.trim();

const textareaClass = inputClass + " resize-none";

// ─────────────────────────────────────────────
// Step 1: Details
// ─────────────────────────────────────────────

function StepDetails({
  form,
  onChange,
  garments,
  garmentsLoading,
}: {
  form: FormData;
  onChange: (key: keyof FormData, value: string | string[] | boolean) => void;
  garments: Garment[];
  garmentsLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-1">Campaign details</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          What are you launching? Give your campaign a clear, compelling name.
        </p>
      </div>

      {/* Garment selector */}
      <FormField label="Garment" required hint="Select the style this campaign is for. Garments are created in your Garment Library.">
        {garmentsLoading ? (
          <div className="h-10 bg-[var(--surface-2)] rounded-[var(--radius-md)] animate-pulse" />
        ) : garments.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-[var(--radius-md)] text-sm">
            <p className="text-amber-700 font-medium mb-1">No garments found</p>
            <p className="text-amber-600">
              Add a garment in your{" "}
              <Link href="/garments/new" className="underline hover:no-underline">Garment Library</Link>{" "}
              before creating a campaign.
            </p>
          </div>
        ) : (
          <select
            value={form.garmentId}
            onChange={(e) => onChange("garmentId", e.target.value)}
            className={inputClass}
          >
            <option value="">Select a garment…</option>
            {garments.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.styleCode ? ` (${g.styleCode})` : ""}{g.category ? ` — ${g.category}` : ""}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {/* Campaign title */}
      <FormField
        label="Campaign title"
        required
        hint={`This appears on the campaign page and in emails. ${form.title.length}/255`}
      >
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="e.g. The Studio Blazer — Drop 01"
          maxLength={255}
          className={inputClass}
        />
      </FormField>

      {/* Description */}
      <FormField
        label="Description"
        required
        hint="Tell backers what they're getting. Be specific about fabric, fit, and why it's worth backing."
      >
        <textarea
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="This blazer is cut from a heavy-weight Italian wool blend, tailored for a clean, structured silhouette. Available exclusively to backers before public retail…"
          rows={5}
          className={textareaClass}
        />
      </FormField>

      {/* Cover image URL */}
      <FormField
        label="Cover image URL"
        hint="The hero image shown at the top of your campaign page. Use a high-res image (at least 1200×800px)."
      >
        <input
          type="url"
          value={form.coverImageUrl}
          onChange={(e) => onChange("coverImageUrl", e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
        {form.coverImageUrl && (
          <div className="mt-2 relative h-32 w-full rounded-[var(--radius-md)] overflow-hidden bg-[var(--surface-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.coverImageUrl}
              alt="Cover preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </FormField>

      {/* Gallery URLs */}
      <FormField
        label="Gallery image URLs"
        hint="One URL per line. Shown in the gallery section of the campaign page."
      >
        <textarea
          value={form.galleryUrls}
          onChange={(e) => onChange("galleryUrls", e.target.value)}
          placeholder={"https://…\nhttps://…"}
          rows={3}
          className={textareaClass}
        />
      </FormField>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2: Pricing & MOQ
// ─────────────────────────────────────────────

function StepPricing({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (key: keyof FormData, value: string | string[] | boolean) => void;
}) {
  const retailCents = form.retailPrice ? toCents(form.retailPrice) : 0;
  const backerCents = form.backerPrice ? toCents(form.backerPrice) : 0;
  const savingsCents = retailCents - backerCents;
  const savingsPct = retailCents > 0 && backerCents > 0
    ? Math.round((savingsCents / retailCents) * 100)
    : 0;
  const moqRevenueCents = backerCents * (parseInt(form.moq) || 0);

  const toggleSize = (size: string) => {
    const current = form.availableSizes;
    onChange(
      "availableSizes",
      current.includes(size)
        ? current.filter((s) => s !== size)
        : [...current, size],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-1">Pricing & minimum order</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Set prices and the minimum number of backers needed to trigger production.
        </p>
      </div>

      {/* Currency */}
      <FormField label="Currency" required>
        <select
          value={form.currency}
          onChange={(e) => onChange("currency", e.target.value)}
          className={inputClass}
        >
          {CURRENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        {/* Retail price */}
        <FormField
          label="Retail price"
          required
          hint={`Price after production goes live`}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
              {form.currency}
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.retailPrice}
              onChange={(e) => onChange("retailPrice", e.target.value)}
              placeholder="0.00"
              className={inputClass + " pl-12"}
            />
          </div>
        </FormField>

        {/* Backer price */}
        <FormField
          label="Backer price"
          required
          hint={savingsPct > 0 ? `Backers save ${savingsPct}%` : "Must be less than retail"}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
              {form.currency}
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.backerPrice}
              onChange={(e) => onChange("backerPrice", e.target.value)}
              placeholder="0.00"
              className={inputClass + " pl-12"}
            />
          </div>
        </FormField>
      </div>

      {/* Price summary */}
      {backerCents > 0 && retailCents > backerCents && (
        <div className="p-3 bg-[#22C55E]/8 border border-[#22C55E]/20 rounded-[var(--radius-md)] text-sm">
          <span className="text-[#22C55E] font-medium">
            Backers save {formatCurrency(savingsCents, form.currency)} ({savingsPct}% off retail)
          </span>
        </div>
      )}

      {/* Deposit percent */}
      <FormField
        label="Deposit percent"
        required
        hint="100 = full payment upfront. 30 = 30% now, remainder charged when goal is reached. Recommended: 100% for first campaigns."
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={form.depositPercent}
            onChange={(e) => onChange("depositPercent", e.target.value)}
            className="flex-1 accent-[var(--loocbooc-black)]"
          />
          <span className="text-sm font-semibold text-[var(--text-primary)] w-16 text-right">
            {form.depositPercent}%
          </span>
        </div>
        {form.depositPercent !== "100" && (
          <p className="text-xs text-amber-600 mt-1">
            ⚠️ Deposit mode adds complexity — some backers may fail the final payment. Start with 100%.
          </p>
        )}
      </FormField>

      {/* Available sizes */}
      <FormField
        label="Available sizes"
        required
        hint="Which sizes will be available for this campaign?"
      >
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((size) => {
            const selected = form.availableSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={`
                  px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors
                  ${selected
                    ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                  }
                `}
              >
                {size}
              </button>
            );
          })}
        </div>
        {form.availableSizes.length > 0 && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            {form.availableSizes.length} sizes selected: {form.availableSizes.join(", ")}
          </p>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        {/* MOQ */}
        <FormField
          label="Minimum order quantity"
          required
          hint={moqRevenueCents > 0 ? `At MOQ: ${formatCurrency(moqRevenueCents, form.currency)} revenue` : "How many backers to trigger production?"}
        >
          <input
            type="number"
            min="1"
            step="1"
            value={form.moq}
            onChange={(e) => onChange("moq", e.target.value)}
            placeholder="e.g. 50"
            className={inputClass}
          />
        </FormField>

        {/* Stretch goal */}
        <FormField
          label="Stretch goal (optional)"
          hint="Unlock a reward when backers exceed this number"
        >
          <input
            type="number"
            min="1"
            step="1"
            value={form.stretchGoalQty}
            onChange={(e) => onChange("stretchGoalQty", e.target.value)}
            placeholder="e.g. 100"
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3: Timeline
// ─────────────────────────────────────────────

function StepTimeline({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (key: keyof FormData, value: string | string[] | boolean) => void;
}) {
  // Default start to tomorrow
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const campaignLengthDays = form.campaignStart && form.campaignEnd
    ? Math.ceil((new Date(form.campaignEnd).getTime() - new Date(form.campaignStart).getTime()) / 86400000)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-1">Campaign timeline</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          When does backing open and close? When will orders ship?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Start date */}
        <FormField label="Campaign opens" required hint="When backers can start placing orders">
          <input
            type="date"
            value={form.campaignStart}
            min={tomorrow}
            onChange={(e) => onChange("campaignStart", e.target.value)}
            className={inputClass}
          />
        </FormField>

        {/* End date */}
        <FormField
          label="Campaign closes"
          required
          hint={campaignLengthDays > 0 ? `${campaignLengthDays} day campaign` : "Deadline to reach MOQ"}
        >
          <input
            type="date"
            value={form.campaignEnd}
            min={form.campaignStart || tomorrow}
            onChange={(e) => onChange("campaignEnd", e.target.value)}
            className={inputClass}
          />
        </FormField>
      </div>

      {/* Estimated ship date */}
      <FormField
        label="Estimated ship date"
        hint="Tell backers when to expect their order. Add buffer for production + delivery."
      >
        <input
          type="date"
          value={form.estimatedShipDate}
          min={form.campaignEnd || tomorrow}
          onChange={(e) => onChange("estimatedShipDate", e.target.value)}
          className={inputClass}
        />
      </FormField>

      {/* Manufacturer ID */}
      <FormField
        label="Manufacturer ID (optional)"
        hint="If you've already connected with a manufacturer for this campaign, add their ID. You can also assign this later."
      >
        <input
          type="text"
          value={form.manufacturerId}
          onChange={(e) => onChange("manufacturerId", e.target.value)}
          placeholder="Manufacturer profile ID…"
          className={inputClass}
        />
        <Link
          href="/manufacturers"
          className="text-xs text-[var(--loocbooc-accent)] hover:underline mt-1 inline-block"
        >
          Find a manufacturer →
        </Link>
      </FormField>

      {/* Timeline summary */}
      {form.campaignStart && form.campaignEnd && (
        <div className="p-4 bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-[var(--radius-lg)] shadow-[var(--shadow-1)]">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Timeline preview</p>
          <div className="space-y-2.5">
            {[
              {
                icon: "📣",
                label: "Campaign opens",
                date: new Date(form.campaignStart).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
              },
              {
                icon: "🏁",
                label: "Campaign closes",
                date: new Date(form.campaignEnd).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
              },
              ...(form.estimatedShipDate ? [{
                icon: "📦",
                label: "Estimated delivery",
                date: new Date(form.estimatedShipDate).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
              }] : []),
            ].map(({ icon, label, date }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-base w-6 text-center">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 4: Review
// ─────────────────────────────────────────────

function StepReview({
  form,
  garments,
}: {
  form: FormData;
  garments: Garment[];
}) {
  const garment = garments.find((g) => g.id === form.garmentId);
  const retailCents = toCents(form.retailPrice);
  const backerCents = toCents(form.backerPrice);
  const savingsPct = Math.round(((retailCents - backerCents) / retailCents) * 100);
  const moqRevenue = backerCents * parseInt(form.moq || "0");
  const slug = slugify(form.title);

  const sections = [
    {
      title: "Campaign details",
      fields: [
        { label: "Garment",     value: garment?.name ?? "—" },
        { label: "Title",       value: form.title },
        { label: "Slug",        value: `/${slug}` },
        { label: "Description", value: form.description.slice(0, 120) + (form.description.length > 120 ? "…" : "") },
        { label: "Cover image", value: form.coverImageUrl || "None" },
      ],
    },
    {
      title: "Pricing & MOQ",
      fields: [
        { label: "Currency",          value: form.currency },
        { label: "Retail price",      value: `${form.currency} ${parseFloat(form.retailPrice || "0").toFixed(2)}` },
        { label: "Backer price",      value: `${form.currency} ${parseFloat(form.backerPrice || "0").toFixed(2)} (${savingsPct}% off)` },
        { label: "Deposit",           value: `${form.depositPercent}%` },
        { label: "Minimum order",     value: `${form.moq} backers` },
        { label: "Revenue at MOQ",    value: `${form.currency} ${(moqRevenue / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}` },
        { label: "Available sizes",   value: form.availableSizes.join(", ") || "None" },
        ...(form.stretchGoalQty ? [{ label: "Stretch goal", value: `${form.stretchGoalQty} backers` }] : []),
      ],
    },
    {
      title: "Timeline",
      fields: [
        { label: "Opens",  value: form.campaignStart ? new Date(form.campaignStart).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "—" },
        { label: "Closes", value: form.campaignEnd ? new Date(form.campaignEnd).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "—" },
        { label: "Est. ship", value: form.estimatedShipDate ? new Date(form.estimatedShipDate).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "Not specified" },
        ...(form.manufacturerId ? [{ label: "Manufacturer", value: form.manufacturerId }] : []),
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-1">Review & launch</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Check everything before creating your campaign. It will be saved as a draft — you can edit and publish when ready.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="bg-[var(--surface-1)] rounded-[var(--radius-lg)] shadow-[var(--shadow-1)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--surface-3)] bg-[var(--surface-2)]">
            <h3 className="font-medium text-sm text-[var(--text-secondary)]">{section.title}</h3>
          </div>
          <div className="divide-y divide-[var(--surface-3)]">
            {section.fields.map(({ label, value }) => (
              <div key={label} className="px-5 py-3 flex gap-4">
                <span className="text-sm text-[var(--text-tertiary)] w-36 shrink-0">{label}</span>
                <span className="text-sm text-[var(--text-primary)] min-w-0 break-words">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-[var(--radius-lg)] text-sm">
        <p className="text-amber-700 font-medium mb-1">Saved as draft</p>
        <p className="text-amber-600">
          Your campaign will be created as a draft. Review it, then publish to make it live for backers.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState<Step>("details");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [garmentsLoading, setGarmentsLoading] = useState(true);

  // Load garments on mount
  const loadGarments = useCallback(async () => {
    setGarmentsLoading(true);
    try {
      const meRes = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!meRes.ok) return;
      const meData = await meRes.json() as { user?: { brandId?: string } };
      const brandId = meData.user?.brandId;
      if (!brandId) return;

      const res = await fetch(`/api/v1/brands/${brandId}/garments?limit=100`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { data: Garment[] };
      setGarments(data.data ?? []);
    } catch {
      // Non-fatal — user will see the "no garments" message
    } finally {
      setGarmentsLoading(false);
    }
  }, []);

  // Use React.useEffect in a way that works with the "use client" directive
  const [mounted, setMounted] = useState(false);
  if (!mounted) {
    // Trigger on next tick
    setTimeout(() => {
      setMounted(true);
      loadGarments().catch(console.error);
    }, 0);
  }

  const onChange = useCallback((key: keyof FormData, value: string | string[] | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStepErrors([]); // Clear errors on change
  }, []);

  const handleNext = () => {
    const errors = validateStep(currentStep, form);
    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);
    const currentIdx = STEP_ORDER.indexOf(currentStep);
    if (currentIdx < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIdx + 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setStepErrors([]);
    const currentIdx = STEP_ORDER.indexOf(currentStep);
    if (currentIdx > 0) {
      setCurrentStep(STEP_ORDER[currentIdx - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    // Validate all steps before submit
    const allErrors = [
      ...validateStep("details", form),
      ...validateStep("pricing", form),
      ...validateStep("timeline", form),
    ];
    if (allErrors.length > 0) {
      setStepErrors(allErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Resolve brandId
      const meRes = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!meRes.ok) throw new Error("Authentication failed");
      const meData = await meRes.json() as { user?: { brandId?: string } };
      const brandId = meData.user?.brandId;
      if (!brandId) throw new Error("Brand not found — make sure you have a brand account.");

      const galleryUrls = form.galleryUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      const payload = {
        brandId,
        garmentId: form.garmentId,
        title: form.title.trim(),
        description: form.description.trim(),
        slug: `${slugify(form.title)}-${Date.now().toString(36)}`,
        coverImageUrl: form.coverImageUrl || null,
        galleryUrls,
        retailPriceCents: toCents(form.retailPrice),
        backerPriceCents: toCents(form.backerPrice),
        depositPercent: parseInt(form.depositPercent),
        currency: form.currency,
        moq: parseInt(form.moq),
        stretchGoalQty: form.stretchGoalQty ? parseInt(form.stretchGoalQty) : null,
        availableSizes: form.availableSizes,
        campaignStart: new Date(form.campaignStart).toISOString(),
        campaignEnd: new Date(form.campaignEnd).toISOString(),
        estimatedShipDate: form.estimatedShipDate ? new Date(form.estimatedShipDate).toISOString() : null,
        manufacturerId: form.manufacturerId || null,
      };

      const res = await fetch("/api/v1/back-it/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string; details?: unknown } };
        throw new Error(body.error?.message ?? "Failed to create campaign");
      }

      const data = await res.json() as { data: { id: string } };
      router.push(`/campaigns/${data.data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const isLastStep = currentStep === "review";
  const currentStepIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/campaigns"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            ← Campaigns
          </Link>
        </div>
        <h1 className="font-display text-3xl text-[var(--text-primary)]">
          Create a campaign
        </h1>
      </header>

      {/* Step progress */}
      <StepProgress current={currentStep} />

      {/* Step content */}
      <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-2)] p-8 mb-6">
        {currentStep === "details" && (
          <StepDetails
            form={form}
            onChange={onChange}
            garments={garments}
            garmentsLoading={garmentsLoading}
          />
        )}
        {currentStep === "pricing" && (
          <StepPricing form={form} onChange={onChange} />
        )}
        {currentStep === "timeline" && (
          <StepTimeline form={form} onChange={onChange} />
        )}
        {currentStep === "review" && (
          <StepReview form={form} garments={garments} />
        )}
      </div>

      {/* Validation errors */}
      {stepErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-[var(--radius-lg)]">
          <p className="text-sm font-medium text-red-700 mb-2">Please fix the following:</p>
          <ul className="list-disc list-inside space-y-1">
            {stepErrors.map((e, i) => (
              <li key={i} className="text-sm text-red-600">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-[var(--radius-lg)] text-sm text-red-600">
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStepIdx === 0}
          className="px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--surface-3)] rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Back
        </button>

        {isLastStep ? (
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="px-8 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-sm font-semibold rounded-[var(--radius-md)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {submitting ? "Creating campaign…" : "Create campaign (draft)"}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-sm font-semibold rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
