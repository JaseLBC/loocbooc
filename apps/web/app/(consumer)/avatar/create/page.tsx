"use client";

/**
 * Avatar creation wizard — consumer-facing.
 *
 * Multi-step form: method → basics → upper → waist → lower → style → preview → complete
 *
 * Design principles:
 * - One screen per step, full mobile focus
 * - Measurements are optional — never block progress
 * - Body shape computed live on the preview step
 * - Saves to API as a draft on each step (auto-save on next)
 * - Spring animations throughout
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Step = "method" | "basics" | "upper" | "waist" | "lower" | "style" | "preview" | "complete";

const STEPS: Step[] = ["method", "basics", "upper", "waist", "lower", "style", "preview", "complete"];

interface AvatarDraft {
  nickname?: string;
  measurementMethod?: "manual" | "estimated";
  height?: number;
  weightKg?: number;
  bust?: number;
  chest?: number;
  shoulderWidth?: number;
  sleeveLength?: number;
  neck?: number;
  waist?: number;
  hips?: number;
  inseam?: number;
  thigh?: number;
  rise?: number;
  bodyShape?: string;
  fitPreference?: string;
}

interface BodyShapeResult {
  shape: string;
  description: string;
  fitTips: string[];
}

const BODY_SHAPES: Record<string, { label: string; description: string; icon: string; tips: string[] }> = {
  hourglass: {
    label: "Hourglass",
    description: "Bust and hips roughly equal, defined waist",
    icon: "⌛",
    tips: ["Fitted waists define your silhouette", "Wrap styles and belted dresses", "Structured blazers over slim trousers"],
  },
  pear: {
    label: "Pear",
    description: "Hips wider than bust, narrower shoulders",
    icon: "🍐",
    tips: ["A-line and fit-and-flare styles", "Draw attention upward with bold necklines", "Dark bottoms, lighter tops for balance"],
  },
  apple: {
    label: "Apple",
    description: "Fuller through the middle, slimmer legs",
    icon: "🍎",
    tips: ["Empire waists and flowy fabrics", "V-necks elongate the torso", "Shift dresses that skim the midsection"],
  },
  rectangle: {
    label: "Rectangle",
    description: "Bust, waist and hips roughly the same width",
    icon: "▭",
    tips: ["Create curves with peplum tops", "Belts and defined waists add shape", "Ruffles and texture add visual interest"],
  },
  inverted_triangle: {
    label: "Inverted Triangle",
    description: "Shoulders and bust wider than hips",
    icon: "▽",
    tips: ["A-line and full skirts balance shoulders", "Wide-leg trousers create balance", "Avoid boat necks and shoulder details"],
  },
};

const FIT_PREFERENCES: { value: string; label: string; description: string }[] = [
  { value: "slim",      label: "Slim",      description: "Close to the body" },
  { value: "regular",   label: "Regular",   description: "True to size, relaxed fit" },
  { value: "relaxed",   label: "Relaxed",   description: "A little room throughout" },
  { value: "oversized", label: "Oversized", description: "Big and boxy" },
];

const AU_SIZES = ["6", "8", "10", "12", "14", "16", "18", "20", "22"];

// ─────────────────────────────────────────────
// Body shape calculation (client-side, mirrors server)
// ─────────────────────────────────────────────

function computeBodyShape(draft: AvatarDraft): BodyShapeResult | null {
  const { bust, waist, hips, shoulderWidth } = draft;
  if (!bust || !waist || !hips) return null;

  const bustHipDiff = Math.abs(bust - hips);
  const waistBust = bust - waist;
  const waistHip = hips - waist;

  let shape: string;

  if (bustHipDiff <= 5 && waistBust >= 9 && waistHip >= 9) {
    shape = "hourglass";
  } else if (hips - bust >= 5) {
    shape = "pear";
  } else if (bust - hips >= 5 || (shoulderWidth && shoulderWidth * 2 - hips >= 5)) {
    shape = "inverted_triangle";
  } else if (waistBust < 7 && waistHip < 7) {
    shape = "rectangle";
  } else {
    shape = "apple";
  }

  const info = BODY_SHAPES[shape];
  if (!info) return null;
  return {
    shape,
    description: info.description,
    fitTips: info.tips,
  };
}

function guessAuSize(draft: AvatarDraft): string | null {
  const { bust, waist, hips } = draft;
  if (!bust && !waist && !hips) return null;

  // Use bust for top sizing
  const b = bust ?? 0;
  if (b < 85) return "6-8";
  if (b < 90) return "8-10";
  if (b < 96) return "10-12";
  if (b < 102) return "12-14";
  if (b < 108) return "14-16";
  if (b < 116) return "16-18";
  return "18+";
}

// ─────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const stepLabels: Record<Step, string> = {
    method: "Method",
    basics: "Basics",
    upper: "Upper",
    waist: "Waist",
    lower: "Lower",
    style: "Style",
    preview: "Preview",
    complete: "Done",
  };

  const currentIdx = STEPS.indexOf(current);
  // Exclude 'complete' from progress display
  const displaySteps = STEPS.filter((s) => s !== "complete");
  const progress = Math.round(((currentIdx) / (displaySteps.length)) * 100);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>
          {stepLabels[current]}
        </span>
        <span style={{ fontSize: 12, color: "#999" }}>
          {currentIdx + 1} / {displaySteps.length + 1}
        </span>
      </div>
      <div style={{
        height: 3,
        background: "#f0f0f0",
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: "var(--loocbooc-black, #0a0a0a)",
          borderRadius: 2,
          transition: "width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Measurement input component
// ─────────────────────────────────────────────

function MeasurementInput({
  label,
  hint,
  value,
  onChange,
  unit = "cm",
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (val: number | undefined) => void;
  unit?: string;
  min?: number;
  max?: number;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: "#1a1a1a",
        marginBottom: 4,
      }}>
        {label}
        <span style={{ color: "#999", fontWeight: 400, marginLeft: 4 }}>({unit})</span>
      </label>
      {hint && (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{hint}</p>
      )}
      <div style={{
        display: "flex",
        alignItems: "center",
        border: `2px solid ${focused ? "#0a0a0a" : "#e5e5e5"}`,
        borderRadius: 8,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? undefined : v);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="—"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            padding: "12px 14px",
            fontSize: 16,
            background: "transparent",
            color: "#1a1a1a",
          }}
        />
        <span style={{
          padding: "0 14px",
          fontSize: 13,
          color: "#999",
          borderLeft: "1px solid #e5e5e5",
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          background: "#fafafa",
        }}>
          {unit}
        </span>
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
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "16px 20px",
        borderRadius: 12,
        border: `2px solid ${selected ? "#0a0a0a" : "#e5e5e5"}`,
        background: selected ? "#0a0a0a" : "#fff",
        color: selected ? "#fff" : "#1a1a1a",
        marginBottom: 10,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: selected ? "scale(1.01)" : "scale(1)",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Step screens
// ─────────────────────────────────────────────

function MethodStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}>
        How do you want to measure?
      </h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        More precise measurements mean better fit recommendations. You can update at any time.
      </p>

      <ChoiceCard
        selected={draft.measurementMethod === "manual"}
        onClick={() => update({ measurementMethod: "manual" })}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>📏  I'll measure myself</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Most accurate — grab a tape measure</div>
      </ChoiceCard>

      <ChoiceCard
        selected={draft.measurementMethod === "estimated"}
        onClick={() => update({ measurementMethod: "estimated" })}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>👗  I'll estimate from my clothes</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Good enough for most recommendations</div>
      </ChoiceCard>

      <div style={{
        marginTop: 20,
        padding: "14px 16px",
        background: "#f8f8f8",
        borderRadius: 10,
        fontSize: 13,
        color: "#666",
      }}>
        📸 <strong>AI photo scan coming soon.</strong> We&apos;re building a body measurement tool from photos — no tape measure needed.
      </div>
    </div>
  );
}

function BasicsStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Basics</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        Height and weight help with general sizing. All fields are optional.
      </p>
      <MeasurementInput
        label="Height"
        hint="Standing height without shoes"
        value={draft.height}
        onChange={(v) => update({ height: v })}
        unit="cm"
        min={120}
        max={220}
      />
      <MeasurementInput
        label="Weight"
        value={draft.weightKg}
        onChange={(v) => update({ weightKg: v })}
        unit="kg"
        min={30}
        max={250}
      />
      <div style={{
        marginBottom: 20,
      }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>
          Nickname for this avatar <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. My measurements"
          value={draft.nickname ?? ""}
          onChange={(e) => update({ nickname: e.target.value || undefined })}
          maxLength={60}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "2px solid #e5e5e5",
            borderRadius: 8,
            fontSize: 16,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

function UpperStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Upper body</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        Measured at the fullest point. Keep the tape snug but not tight.
      </p>
      <MeasurementInput
        label="Bust"
        hint="Around the fullest part of your chest"
        value={draft.bust}
        onChange={(v) => update({ bust: v })}
        min={60}
        max={160}
      />
      <MeasurementInput
        label="Chest"
        hint="Around your chest just below your bust"
        value={draft.chest}
        onChange={(v) => update({ chest: v })}
        min={55}
        max={160}
      />
      <MeasurementInput
        label="Shoulder width"
        hint="Across the back from shoulder point to shoulder point"
        value={draft.shoulderWidth}
        onChange={(v) => update({ shoulderWidth: v })}
        min={25}
        max={65}
      />
      <MeasurementInput
        label="Sleeve length"
        hint="From shoulder point to wrist"
        value={draft.sleeveLength}
        onChange={(v) => update({ sleeveLength: v })}
        min={35}
        max={90}
      />
    </div>
  );
}

function WaistStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Waist</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        The narrowest part of your torso, usually 2–3cm above your belly button.
      </p>
      <MeasurementInput
        label="Waist"
        hint="Measure at your natural waist — the narrowest point"
        value={draft.waist}
        onChange={(v) => update({ waist: v })}
        min={45}
        max={160}
      />
      <MeasurementInput
        label="Neck"
        hint="Around the base of your neck"
        value={draft.neck}
        onChange={(v) => update({ neck: v })}
        min={25}
        max={55}
      />
    </div>
  );
}

function LowerStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Lower body</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        These measurements power trouser, skirt, and jumpsuit recommendations.
      </p>
      <MeasurementInput
        label="Hips"
        hint="Around the fullest part of your hips/seat"
        value={draft.hips}
        onChange={(v) => update({ hips: v })}
        min={60}
        max={160}
      />
      <MeasurementInput
        label="Inseam"
        hint="From crotch to the floor (inner leg)"
        value={draft.inseam}
        onChange={(v) => update({ inseam: v })}
        min={45}
        max={100}
      />
      <MeasurementInput
        label="Thigh"
        hint="Around the fullest part of one thigh"
        value={draft.thigh}
        onChange={(v) => update({ thigh: v })}
        min={35}
        max={90}
      />
      <MeasurementInput
        label="Rise"
        hint="From crotch seam to natural waist (front)"
        value={draft.rise}
        onChange={(v) => update({ rise: v })}
        min={20}
        max={45}
      />
    </div>
  );
}

function StyleStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Fit preference</h2>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        How do you like your clothes to fit? This adjusts how we size you.
      </p>

      {FIT_PREFERENCES.map((pref) => (
        <ChoiceCard
          key={pref.value}
          selected={draft.fitPreference === pref.value}
          onClick={() => update({ fitPreference: pref.value })}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{pref.label}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>{pref.description}</div>
        </ChoiceCard>
      ))}
    </div>
  );
}

function PreviewStep({ draft, update }: { draft: AvatarDraft; update: (d: Partial<AvatarDraft>) => void }) {
  const bodyShape = computeBodyShape(draft);
  const estimatedSize = guessAuSize(draft);
  const filledCount = [
    draft.height, draft.bust, draft.waist, draft.hips,
    draft.inseam, draft.shoulderWidth, draft.sleeveLength,
    draft.chest, draft.thigh, draft.rise, draft.neck,
  ].filter(Boolean).length;
  const completionPercent = Math.round((filledCount / 11) * 100);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your profile</h2>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        Here&apos;s what we&apos;ve worked out from your measurements.
      </p>

      {/* Body shape card */}
      {bodyShape ? (
        <div style={{
          background: "#f8f8f8",
          borderRadius: 14,
          padding: "20px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 36 }}>
              {BODY_SHAPES[bodyShape.shape]?.icon ?? "◯"}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                {BODY_SHAPES[bodyShape.shape]?.label ?? bodyShape.shape} shape
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>{bodyShape.description}</div>
            </div>
          </div>
          <div>
            {bodyShape.fitTips.map((tip, i) => (
              <div key={i} style={{ fontSize: 13, color: "#555", marginBottom: 4, display: "flex", gap: 8 }}>
                <span style={{ color: "#0a0a0a", fontWeight: 600 }}>→</span>
                {tip}
              </div>
            ))}
          </div>
          {/* Allow override */}
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Not right? Select your shape:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(BODY_SHAPES).map(([shape, info]) => (
                <button
                  key={shape}
                  onClick={() => update({ bodyShape: shape })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${draft.bodyShape === shape || (!draft.bodyShape && bodyShape.shape === shape) ? "#0a0a0a" : "#ddd"}`,
                    background: draft.bodyShape === shape || (!draft.bodyShape && bodyShape.shape === shape) ? "#0a0a0a" : "#fff",
                    color: draft.bodyShape === shape || (!draft.bodyShape && bodyShape.shape === shape) ? "#fff" : "#555",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {info.icon} {info.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: "#f8f8f8",
          borderRadius: 14,
          padding: "20px",
          marginBottom: 16,
          textAlign: "center",
          color: "#888",
          fontSize: 14,
        }}>
          Add bust, waist, and hip measurements to see your body shape estimate.
        </div>
      )}

      {/* Size estimate */}
      {estimatedSize && (
        <div style={{
          background: "#0a0a0a",
          color: "#fff",
          borderRadius: 14,
          padding: "18px 20px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>Estimated AU size</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{estimatedSize}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>Profile complete</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{completionPercent}%</div>
          </div>
        </div>
      )}

      {/* Fit preference */}
      <div style={{
        background: "#f8f8f8",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Fit preference</div>
        <div style={{ fontWeight: 600 }}>
          {FIT_PREFERENCES.find((p) => p.value === draft.fitPreference)?.label ?? "Not set"}{" "}
          {draft.fitPreference && (
            <span style={{ fontWeight: 400, color: "#666", fontSize: 13 }}>
              — {FIT_PREFERENCES.find((p) => p.value === draft.fitPreference)?.description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CompleteStep() {
  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
        Your avatar is ready
      </h2>
      <p style={{ color: "#666", fontSize: 16, marginBottom: 32, maxWidth: 280, margin: "0 auto 32px" }}>
        Every time you back a style or browse products, we&apos;ll show you the right size for your body.
      </p>
      <div style={{
        background: "#f8f8f8",
        borderRadius: 14,
        padding: "20px",
        textAlign: "left",
        marginBottom: 24,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>What happens next</div>
        {[
          "Browse campaigns — we'll pre-select your size",
          "See fit confidence scores on every garment",
          "Update measurements anytime from your profile",
          "Size recommendations improve over time",
        ].map((item, i) => (
          <div key={i} style={{ fontSize: 14, color: "#555", marginBottom: 8, display: "flex", gap: 10 }}>
            <span>→</span>{item}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main wizard component
// ─────────────────────────────────────────────

export default function AvatarCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("method");
  const [draft, setDraft] = useState<AvatarDraft>({
    measurementMethod: "manual",
    fitPreference: "regular",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAvatarId, setCreatedAvatarId] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const update = useCallback((partial: Partial<AvatarDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const currentStepIndex = STEPS.indexOf(step);
  const isLast = step === "preview";
  const isComplete = step === "complete";

  async function handleNext() {
    if (isComplete) {
      router.push(createdAvatarId ? `/avatar/${createdAvatarId}` : "/avatar");
      return;
    }

    if (isLast) {
      // Submit to API
      setSaving(true);
      setError(null);
      try {
        const bodyShape = computeBodyShape(draft);
        const payload = {
          ...draft,
          bodyShape: draft.bodyShape ?? bodyShape?.shape ?? undefined,
        };

        const res = await fetch("/api/v1/avatars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json() as { error?: { message?: string } };
          throw new Error(data.error?.message ?? "Failed to save avatar");
        }

        const data = await res.json() as { avatar: { id: string } };
        setCreatedAvatarId(data.avatar.id);
        setStep("complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextStep = STEPS[currentStepIndex + 1] as Step;
    setStep(nextStep);
  }

  function handleBack() {
    if (currentStepIndex === 0) return;
    const prevStep = STEPS[currentStepIndex - 1] as Step;
    setStep(prevStep);
  }

  const stepProps = { draft, update };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 0",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        {!isComplete && currentStepIndex > 0 && (
          <button
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px 4px 0",
              fontSize: 20,
              color: "#555",
            }}
            aria-label="Go back"
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
            onClick={() => router.push("/avatar")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "#888",
              padding: 0,
            }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "20px 20px 0", maxWidth: 480, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {!isComplete && <StepBar current={step} />}

        <div style={{
          animation: "slideIn 0.3s ease-out",
        }}>
          {step === "method"   && <MethodStep   {...stepProps} />}
          {step === "basics"   && <BasicsStep   {...stepProps} />}
          {step === "upper"    && <UpperStep    {...stepProps} />}
          {step === "waist"    && <WaistStep    {...stepProps} />}
          {step === "lower"    && <LowerStep    {...stepProps} />}
          {step === "style"    && <StyleStep    {...stepProps} />}
          {step === "preview"  && <PreviewStep  {...stepProps} />}
          {step === "complete" && <CompleteStep />}
        </div>

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
      <div style={{
        padding: "16px 20px 32px",
        maxWidth: 480,
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box",
      }}>
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
            transition: "background 0.2s",
          }}
        >
          {saving
            ? "Saving..."
            : isComplete
            ? "Go to my avatar"
            : isLast
            ? "Save my avatar"
            : "Next →"}
        </button>

        {!isComplete && step !== "method" && (
          <button
            onClick={handleNext}
            style={{
              display: "block",
              width: "100%",
              marginTop: 10,
              padding: "12px 24px",
              background: "transparent",
              color: "#888",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Skip this step
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
