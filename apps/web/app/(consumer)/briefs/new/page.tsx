"use client";

/**
 * Submit a style brief — consumer-facing multi-step form.
 *
 * Steps:
 *   1. Occasion — what are you dressing for?
 *   2. Budget — price range
 *   3. Size & avatar — link to avatar or enter size manually
 *   4. Style notes — open text + brand preferences / exclusions
 *   5. Stylist — pick specific stylist or open to all
 *   6. Review & submit
 *
 * API:
 *   POST /api/v1/briefs
 *   Query params: ?stylistId= (pre-selects a stylist from profile page CTA)
 *
 * Design:
 * - One-screen-per-step on mobile
 * - Full-width CTA at bottom, always visible
 * - All steps optional except occasion (minimum viable brief)
 * - Auto-fills avatar data if user has a primary avatar
 * - Links to stylist profile mid-flow to let user confirm choice
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Step = "occasion" | "budget" | "size" | "style" | "stylist" | "review" | "submitted";
const STEPS: Step[] = ["occasion", "budget", "size", "style", "stylist", "review", "submitted"];

interface BriefDraft {
  title?: string;
  occasion: string[];
  budgetMin?: number;
  budgetMax?: number;
  styleNotes?: string;
  brandPreferences: string[];
  excludedBrands: string[];
  avatarId?: string;
  sizeAu?: string;
  stylistId?: string;
  deadline?: string;
}

interface AvatarSummary {
  id: string;
  nickname: string | null;
  isPrimary: boolean;
  sizeAu: string | null;
  completionPercent: number;
  confidenceLabel: string;
}

interface StylistOption {
  id: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  specialisations: string[];
  avgRating: number | null;
  completedBriefs: number;
  pricePerBriefCents: number;
  isAvailable: boolean;
  verified: boolean;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const OCCASIONS = [
  { value: "work",        label: "Work & Office",      icon: "💼" },
  { value: "casual",      label: "Everyday casual",    icon: "🌤" },
  { value: "event",       label: "Special event",      icon: "🎉" },
  { value: "date",        label: "Date night",         icon: "💃" },
  { value: "travel",      label: "Travel",             icon: "✈️" },
  { value: "wedding",     label: "Wedding guest",      icon: "💍" },
  { value: "interview",   label: "Interview",          icon: "📋" },
  { value: "activewear",  label: "Activewear",         icon: "🏃‍♀️" },
  { value: "weekend",     label: "Weekend",            icon: "☀️" },
  { value: "resort",      label: "Resort / holiday",   icon: "🌴" },
];

const BUDGET_OPTIONS = [
  { min: 0,    max: 100,  label: "Under $100" },
  { min: 100,  max: 250,  label: "$100–$250" },
  { min: 250,  max: 500,  label: "$250–$500" },
  { min: 500,  max: 1000, label: "$500–$1,000" },
  { min: 1000, max: 9999, label: "$1,000+" },
];

const AU_SIZES = ["6", "8", "10", "12", "14", "16", "18", "20", "22"];

// ─────────────────────────────────────────────
// Step progress bar
// ─────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const displaySteps = STEPS.filter((s) => s !== "submitted");
  const idx = displaySteps.indexOf(current);
  const progress = Math.round(((idx + 1) / (displaySteps.length + 1)) * 100);

  const labels: Record<Step, string> = {
    occasion: "Occasion",
    budget: "Budget",
    size: "Size",
    style: "Style notes",
    stylist: "Stylist",
    review: "Review",
    submitted: "Done",
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#666" }}>{labels[current]}</span>
        <span style={{ fontSize: 12, color: "#aaa" }}>{idx + 1} / {displaySteps.length}</span>
      </div>
      <div style={{ height: 3, background: "#f0f0f0", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: "#0a0a0a",
          borderRadius: 2,
          transition: "width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Choice card
// ─────────────────────────────────────────────

function ChoiceCard({
  selected,
  onClick,
  icon,
  label,
  sublabel,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: "14px 18px",
        borderRadius: 12,
        border: `2px solid ${selected ? "#0a0a0a" : "#e5e5e5"}`,
        background: selected ? "#0a0a0a" : "#fff",
        color: selected ? "#fff" : "#1a1a1a",
        marginBottom: 8,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {icon && <span style={{ fontSize: 22 }}>{icon}</span>}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>{sublabel}</div>
        )}
      </div>
      {selected && <span style={{ fontSize: 14 }}>✓</span>}
    </button>
  );
}

// ─────────────────────────────────────────────
// STEP: Occasion
// ─────────────────────────────────────────────

function OccasionStep({ draft, update }: { draft: BriefDraft; update: (d: Partial<BriefDraft>) => void }) {
  const toggle = (value: string) => {
    const current = draft.occasion;
    update({
      occasion: current.includes(value)
        ? current.filter((o) => o !== value)
        : [...current, value],
    });
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}>
        What are you dressing for?
      </h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Select all that apply. This helps your stylist understand your needs.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {OCCASIONS.map((occ) => (
          <button
            key={occ.value}
            onClick={() => toggle(occ.value)}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: `2px solid ${draft.occasion.includes(occ.value) ? "#0a0a0a" : "#e5e5e5"}`,
              background: draft.occasion.includes(occ.value) ? "#0a0a0a" : "#fff",
              color: draft.occasion.includes(occ.value) ? "#fff" : "#1a1a1a",
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 24 }}>{occ.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{occ.label}</span>
          </button>
        ))}
      </div>

      {/* Optional title */}
      <div style={{ marginTop: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>
          Brief title <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 'Summer wedding guest outfits'"
          value={draft.title ?? ""}
          onChange={(e) => update({ title: e.target.value || undefined })}
          maxLength={120}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "2px solid #e5e5e5",
            borderRadius: 10,
            fontSize: 15,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP: Budget
// ─────────────────────────────────────────────

function BudgetStep({ draft, update }: { draft: BriefDraft; update: (d: Partial<BriefDraft>) => void }) {
  const selectedOption = BUDGET_OPTIONS.find(
    (o) => o.min === draft.budgetMin && o.max === draft.budgetMax
  );

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>What's your budget?</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        This is the total you'd like to spend across the whole look, not per item.
      </p>
      {BUDGET_OPTIONS.map((opt) => (
        <ChoiceCard
          key={opt.label}
          selected={selectedOption?.label === opt.label}
          onClick={() => update({ budgetMin: opt.min, budgetMax: opt.max })}
          label={opt.label}
        />
      ))}

      {/* Custom range */}
      <div style={{ marginTop: 12, padding: "16px", border: "1.5px solid #e5e5e5", borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          Custom range <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Min ($)</label>
            <input
              type="number"
              min={0}
              value={draft.budgetMin ?? ""}
              onChange={(e) => update({ budgetMin: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid #e5e5e5",
                borderRadius: 8,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Max ($)</label>
            <input
              type="number"
              min={0}
              value={draft.budgetMax ?? ""}
              onChange={(e) => update({ budgetMax: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid #e5e5e5",
                borderRadius: 8,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP: Size & Avatar
// ─────────────────────────────────────────────

function SizeStep({
  draft,
  update,
  avatars,
}: {
  draft: BriefDraft;
  update: (d: Partial<BriefDraft>) => void;
  avatars: AvatarSummary[];
}) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your size</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        This helps your stylist pick the right sizes. You can link your measurements or enter a size manually.
      </p>

      {/* Avatar selection */}
      {avatars.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Use your measurements avatar:</div>
          {avatars.map((avatar) => (
            <ChoiceCard
              key={avatar.id}
              selected={draft.avatarId === avatar.id}
              onClick={() => update({ avatarId: avatar.id, sizeAu: avatar.sizeAu ?? undefined })}
              icon={avatar.isPrimary ? "⭐" : "👤"}
              label={avatar.nickname ?? "My avatar"}
              sublabel={[
                `${avatar.completionPercent}% complete`,
                avatar.sizeAu ? `AU ${avatar.sizeAu}` : null,
                avatar.confidenceLabel !== "uncalibrated" ? `${avatar.confidenceLabel} confidence` : null,
              ].filter(Boolean).join(" · ")}
            />
          ))}
          <ChoiceCard
            selected={!draft.avatarId}
            onClick={() => update({ avatarId: undefined })}
            label="Enter size manually"
            sublabel="Quick option if you don't have an avatar"
          />
        </div>
      )}

      {/* Manual size */}
      {(!draft.avatarId || avatars.length === 0) && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>AU size (optional):</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {AU_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => update({ sizeAu: draft.sizeAu === size ? undefined : size })}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `2px solid ${draft.sizeAu === size ? "#0a0a0a" : "#e5e5e5"}`,
                  background: draft.sizeAu === size ? "#0a0a0a" : "#fff",
                  color: draft.sizeAu === size ? "#fff" : "#555",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  minWidth: 52,
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No avatar nudge */}
      {avatars.length === 0 && (
        <div style={{
          marginTop: 20,
          padding: "14px 16px",
          background: "#f8f8f8",
          borderRadius: 12,
          fontSize: 13,
          color: "#666",
        }}>
          📏 <strong>Tip:</strong> Add your measurements in{" "}
          <a href="/avatar/create" style={{ color: "#0a0a0a", fontWeight: 600 }}>your avatar profile</a>{" "}
          for more accurate size recommendations from your stylist.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP: Style notes
// ─────────────────────────────────────────────

function StyleNotesStep({ draft, update }: { draft: BriefDraft; update: (d: Partial<BriefDraft>) => void }) {
  const [brandInput, setBrandInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  const addBrand = (list: "brandPreferences" | "excludedBrands", input: string, setInput: (v: string) => void) => {
    const val = input.trim();
    if (!val) return;
    const current = draft[list] as string[];
    if (!current.includes(val)) {
      update({ [list]: [...current, val] });
    }
    setInput("");
  };

  const removeItem = (list: "brandPreferences" | "excludedBrands", item: string) => {
    update({ [list]: (draft[list] as string[]).filter((b) => b !== item) });
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Style notes</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Tell your stylist about your aesthetic, what you love and don't love. Be as specific as you like.
      </p>

      {/* Open text */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
          What are you looking for? <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          placeholder="e.g. 'I love clean, minimalist pieces in neutral tones. Nothing overly feminine — more structured and androgynous. Avoiding anything with logos.'"
          value={draft.styleNotes ?? ""}
          onChange={(e) => update({ styleNotes: e.target.value || undefined })}
          maxLength={1000}
          rows={5}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "2px solid #e5e5e5",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            resize: "vertical",
            lineHeight: 1.6,
            color: "#1a1a1a",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
        <div style={{ fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 4 }}>
          {(draft.styleNotes ?? "").length} / 1000
        </div>
      </div>

      {/* Brand preferences */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
          Brands you love <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Add a brand..."
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBrand("brandPreferences", brandInput, setBrandInput); } }}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={() => addBrand("brandPreferences", brandInput, setBrandInput)}
            style={{
              padding: "10px 16px",
              background: "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
        {draft.brandPreferences.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {draft.brandPreferences.map((brand) => (
              <span key={brand} style={{
                padding: "4px 12px",
                background: "#0a0a0a",
                color: "#fff",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {brand}
                <button
                  onClick={() => removeItem("brandPreferences", brand)}
                  style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, opacity: 0.6, fontSize: 13 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Excluded brands */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
          Brands to avoid <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Add a brand to exclude..."
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBrand("excludedBrands", excludeInput, setExcludeInput); } }}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={() => addBrand("excludedBrands", excludeInput, setExcludeInput)}
            style={{
              padding: "10px 16px",
              background: "#f5f5f5",
              color: "#555",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
        {draft.excludedBrands.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {draft.excludedBrands.map((brand) => (
              <span key={brand} style={{
                padding: "4px 12px",
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                ✕ {brand}
                <button
                  onClick={() => removeItem("excludedBrands", brand)}
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 0, opacity: 0.6, fontSize: 12 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP: Stylist selection
// ─────────────────────────────────────────────

function StylistStep({
  draft,
  update,
  preselected,
}: {
  draft: BriefDraft;
  update: (d: Partial<BriefDraft>) => void;
  preselected: StylistOption | null;
}) {
  const [stylists, setStylists] = useState<StylistOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/stylists?available=true&limit=10", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { stylists: StylistOption[] };
        setStylists(data.stylists);
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const displayStylists = preselected
    ? [preselected, ...stylists.filter((s) => s.id !== preselected.id)]
    : stylists;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Choose a stylist</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Pick a specific stylist or let any available stylist claim your brief.
      </p>

      {/* Open to any */}
      <ChoiceCard
        selected={!draft.stylistId}
        onClick={() => update({ stylistId: undefined })}
        icon="🌐"
        label="Open to any available stylist"
        sublabel="Fastest response — any verified stylist can accept"
      />

      {/* Available stylists */}
      {loading ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "#888", fontSize: 14 }}>
          Loading stylists...
        </div>
      ) : (
        displayStylists.map((stylist) => (
          <ChoiceCard
            key={stylist.id}
            selected={draft.stylistId === stylist.id}
            onClick={() => update({ stylistId: stylist.id })}
            icon={stylist.verified ? "✓" : "✂️"}
            label={`${stylist.displayName}${stylist.pricePerBriefCents === 0 ? " · Free" : ` · $${(stylist.pricePerBriefCents / 100).toFixed(0)}`}`}
            sublabel={[
              stylist.specialisations.slice(0, 2).join(", "),
              stylist.avgRating ? `★ ${stylist.avgRating.toFixed(1)} (${stylist.completedBriefs} briefs)` : `${stylist.completedBriefs} briefs`,
            ].filter(Boolean).join(" · ")}
          />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP: Review
// ─────────────────────────────────────────────

function ReviewStep({ draft, preselectedStylist }: { draft: BriefDraft; preselectedStylist: StylistOption | null }) {
  const budgetText = draft.budgetMin !== undefined && draft.budgetMax !== undefined
    ? `$${draft.budgetMin}–$${draft.budgetMax}`
    : draft.budgetMin !== undefined
    ? `From $${draft.budgetMin}`
    : "Not specified";

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Review your brief</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Make sure everything looks right before submitting.
      </p>

      <div style={{ background: "#f8f8f8", borderRadius: 16, overflow: "hidden" }}>
        {[
          {
            label: "Occasions",
            value: draft.occasion.length > 0
              ? draft.occasion.map((o) => OCCASIONS.find((x) => x.value === o)?.label ?? o).join(", ")
              : "Not specified",
          },
          { label: "Budget", value: budgetText },
          {
            label: "Size",
            value: draft.sizeAu
              ? `AU ${draft.sizeAu}`
              : draft.avatarId
              ? "From avatar (measurements linked)"
              : "Not specified",
          },
          { label: "Style notes", value: draft.styleNotes ?? "Not provided" },
          {
            label: "Preferred brands",
            value: draft.brandPreferences.length > 0 ? draft.brandPreferences.join(", ") : "None",
          },
          {
            label: "Excluded brands",
            value: draft.excludedBrands.length > 0 ? draft.excludedBrands.join(", ") : "None",
          },
          {
            label: "Stylist",
            value: draft.stylistId && preselectedStylist?.id === draft.stylistId
              ? preselectedStylist.displayName
              : draft.stylistId
              ? "Specific stylist selected"
              : "Open to any available stylist",
          },
        ].map(({ label, value }, i) => (
          <div key={label} style={{
            padding: "14px 18px",
            borderBottom: i < 6 ? "1px solid #e8e8e8" : "none",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", width: 100, flexShrink: 0, paddingTop: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </div>
            <div style={{ fontSize: 14, color: "#1a1a1a", flex: 1, lineHeight: 1.5 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: "14px 16px", background: "#f8f8f8", borderRadius: 12, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
        🔒 Your brief is only visible to vetted stylists. We never share your personal measurements or contact details without your permission.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP: Submitted
// ─────────────────────────────────────────────

function SubmittedStep() {
  return (
    <div style={{ textAlign: "center", paddingTop: 24 }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
        Brief submitted!
      </h2>
      <p style={{ color: "#666", fontSize: 16, marginBottom: 32, maxWidth: 300, margin: "0 auto 32px" }}>
        A stylist will review your brief and accept it shortly.
        You'll be notified when your lookbook is ready.
      </p>
      <div style={{ background: "#f8f8f8", borderRadius: 14, padding: "20px", textAlign: "left", maxWidth: 320, margin: "0 auto 24px" }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>What happens next</div>
        {[
          "A stylist reviews and accepts your brief",
          "They build a personalised lookbook for you",
          "You receive a notification when it's ready",
          "Review, accept items, and back the ones you love",
        ].map((item, i) => (
          <div key={i} style={{ fontSize: 13, color: "#555", marginBottom: 8, display: "flex", gap: 10 }}>
            <span>→</span><span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────

export default function NewBriefPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStylistId = searchParams.get("stylistId");

  const [step, setStep] = useState<Step>("occasion");
  const [draft, setDraft] = useState<BriefDraft>({
    occasion: [],
    brandPreferences: [],
    excludedBrands: [],
    stylistId: preselectedStylistId ?? undefined,
  });
  const [avatars, setAvatars] = useState<AvatarSummary[]>([]);
  const [preselectedStylist, setPreselectedStylist] = useState<StylistOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBriefId, setCreatedBriefId] = useState<string | null>(null);

  const currentIdx = STEPS.indexOf(step);
  const isLast = step === "review";
  const isComplete = step === "submitted";

  const update = useCallback((partial: Partial<BriefDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  // Load avatars and preselected stylist
  useEffect(() => {
    async function load() {
      try {
        const [avatarRes, stylistRes] = await Promise.all([
          fetch("/api/v1/avatars", { credentials: "include" }),
          preselectedStylistId
            ? fetch(`/api/v1/stylists/${preselectedStylistId}`, { credentials: "include" })
            : Promise.resolve(null),
        ]);
        if (avatarRes.ok) {
          const data = await avatarRes.json() as { avatars: AvatarSummary[] };
          setAvatars(data.avatars);
          const primary = data.avatars.find((a) => a.isPrimary);
          if (primary) update({ avatarId: primary.id, sizeAu: primary.sizeAu ?? undefined });
        }
        if (stylistRes?.ok) {
          const data = await stylistRes.json() as { stylist: StylistOption };
          setPreselectedStylist(data.stylist);
        }
      } catch {
        // non-critical
      }
    }
    void load();
  }, [preselectedStylistId, update]);

  async function handleNext() {
    if (isComplete) {
      router.push(createdBriefId ? `/briefs/${createdBriefId}` : "/briefs");
      return;
    }

    if (step === "occasion" && draft.occasion.length === 0) {
      setError("Please select at least one occasion.");
      return;
    }
    setError(null);

    if (isLast) {
      setSaving(true);
      try {
        const res = await fetch("/api/v1/briefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: draft.title,
            occasion: draft.occasion,
            budgetMinCents: draft.budgetMin ? draft.budgetMin * 100 : undefined,
            budgetMaxCents: draft.budgetMax ? draft.budgetMax * 100 : undefined,
            styleNotes: draft.styleNotes,
            brandPreferences: draft.brandPreferences,
            excludedBrands: draft.excludedBrands,
            avatarId: draft.avatarId,
            sizeInfo: draft.sizeAu ? { sizeAu: draft.sizeAu } : undefined,
            stylistId: draft.stylistId,
          }),
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/auth/login?redirect=/briefs/new");
            return;
          }
          const data = await res.json() as { error?: { message?: string } };
          throw new Error(data.error?.message ?? "Failed to submit brief");
        }

        const data = await res.json() as { brief: { id: string } };
        setCreatedBriefId(data.brief.id);
        setStep("submitted");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextStep = STEPS[currentIdx + 1] as Step;
    if (nextStep !== "submitted") setStep(nextStep);
  }

  function handleBack() {
    if (currentIdx === 0 || isComplete) return;
    setStep(STEPS[currentIdx - 1] as Step);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        {!isComplete && currentIdx > 0 && (
          <button
            onClick={handleBack}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: 0 }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <a href="/" style={{ fontSize: 16, fontWeight: 700, textDecoration: "none", color: "#0a0a0a" }}>
            loocbooc
          </a>
        </div>
        {!isComplete && (
          <button
            onClick={() => router.push("/stylists")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#888", padding: 0 }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "20px 20px 0", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {!isComplete && <StepBar current={step} />}

        {step === "occasion"  && <OccasionStep draft={draft} update={update} />}
        {step === "budget"    && <BudgetStep draft={draft} update={update} />}
        {step === "size"      && <SizeStep draft={draft} update={update} avatars={avatars} />}
        {step === "style"     && <StyleNotesStep draft={draft} update={update} />}
        {step === "stylist"   && <StylistStep draft={draft} update={update} preselected={preselectedStylist} />}
        {step === "review"    && <ReviewStep draft={draft} preselectedStylist={preselectedStylist} />}
        {step === "submitted" && <SubmittedStep />}

        {error && (
          <div style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            fontSize: 14,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: "16px 20px 32px", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <button
          onClick={handleNext}
          disabled={saving}
          style={{
            display: "block",
            width: "100%",
            padding: "16px 24px",
            background: saving ? "#555" : "#0a0a0a",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Submitting..." :
           isComplete ? "View my briefs" :
           isLast ? "Submit brief" :
           "Next →"}
        </button>

        {!isComplete && step !== "occasion" && (
          <button
            onClick={handleNext}
            style={{
              display: "block",
              width: "100%",
              marginTop: 10,
              padding: "12px",
              background: "transparent",
              color: "#888",
              border: "none",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Skip this step
          </button>
        )}
      </div>
    </div>
  );
}
