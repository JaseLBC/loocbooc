/**
 * New Garment — /garments/new
 *
 * Multi-step wizard for adding a garment to the 3D pipeline.
 *
 * Steps:
 *   1. BASICS       — name, category, season, style code, description
 *   2. FABRIC       — composition string + physics sliders (drape, stretch, weight…)
 *                     "Auto-detect from label" calls POST /api/v1/fabrics/physics
 *   3. MEASUREMENTS — sample garment measurements (cm) used for fit engine
 *   4. UPLOAD       — choose upload method (CLO 3D, pattern, photos, measurements only)
 *                     file upload UI — posts to POST /api/v1/garments/:ugi/files
 *   5. DONE         — UGI shown, pipeline status link, next steps
 *
 * On wizard completion: POST /api/v1/garments → redirects to /garments/:ugi
 *
 * Note: File upload in step 4 happens after the garment is created so we
 * have a UGI to attach assets to. The wizard creates the garment at the end
 * of step 3, then shows step 4 for uploads.
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Category =
  | "tops" | "bottoms" | "dresses" | "outerwear" | "suits"
  | "activewear" | "swimwear" | "underwear" | "accessories"
  | "footwear" | "bags" | "hats" | "other";

type Season = "SS" | "AW" | "all-season" | "resort";
type UploadMethod = "clo3d" | "pattern" | "photos" | "measurements";
type Step = "basics" | "fabric" | "measurements" | "upload" | "done";

interface FabricPhysics {
  drape: number;
  stretch: number;
  weight: number;
  breathability: number;
  sheen: number;
}

interface FormData {
  // Basics
  name: string;
  category: Category | "";
  season: Season | "";
  sku: string;
  description: string;
  // Fabric
  fabricComposition: string;
  physics: FabricPhysics;
  physicsCustomised: boolean;
  // Measurements
  chest: string;
  waist: string;
  hem: string;
  sleeveLength: string;
  totalLength: string;
  shoulderWidth: string;
  measurementNotes: string;
  // Upload
  uploadMethod: UploadMethod | "";
}

interface GarmentSummary {
  ugi: string;
  id: string;
  name: string;
  status: string;
}

const INITIAL_FORM: FormData = {
  name: "",
  category: "",
  season: "",
  sku: "",
  description: "",
  fabricComposition: "",
  physics: { drape: 50, stretch: 30, weight: 50, breathability: 60, sheen: 20 },
  physicsCustomised: false,
  chest: "",
  waist: "",
  hem: "",
  sleeveLength: "",
  totalLength: "",
  shoulderWidth: "",
  measurementNotes: "",
  uploadMethod: "",
};

const STEPS: Step[] = ["basics", "fabric", "measurements", "upload", "done"];

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─────────────────────────────────────────────
// Physics slider
// ─────────────────────────────────────────────

function PhysicsSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontWeight: 600, fontSize: 13, color: "#1a1a1a" }}>{label}</label>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a", minWidth: 28, textAlign: "right" }}>{value}</span>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>{description}</p>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: "100%", accentColor: "#1a1a1a" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#ccc", marginTop: 2 }}>
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step indicators
// ─────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  basics: "Basics",
  fabric: "Fabric",
  measurements: "Measurements",
  upload: "Upload",
  done: "Done",
};

function StepIndicator({ current, completed }: { current: Step; completed: Set<Step> }) {
  const visibleSteps = STEPS.filter((s) => s !== "done");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
      {visibleSteps.map((step, idx) => {
        const isComplete = completed.has(step) && step !== current;
        const isCurrent = step === current;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: isComplete ? "#1a1a1a" : isCurrent ? "#1a1a1a" : "#e5e5e5",
                color: isComplete || isCurrent ? "#fff" : "#aaa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {isComplete ? "✓" : idx + 1}
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? "#1a1a1a" : isComplete ? "#666" : "#bbb",
              }}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {idx < visibleSteps.length - 1 && (
              <div style={{ width: 24, height: 1, background: "#e5e5e5", margin: "0 12px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Input component
// ─────────────────────────────────────────────

function Field({
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
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#1a1a1a", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>{hint}</p>}
      {children}
      {error && <p style={{ fontSize: 12, color: "#ef4444", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  fontSize: 14,
  color: "#1a1a1a",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box" as const,
};

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical" as const,
  minHeight: 80,
};

// ─────────────────────────────────────────────
// Upload method card
// ─────────────────────────────────────────────

const UPLOAD_METHODS: Array<{
  id: UploadMethod;
  label: string;
  description: string;
  icon: string;
  pipelineTime: string;
  recommended?: boolean;
}> = [
  {
    id: "clo3d",
    label: "CLO 3D File",
    description: "Upload a .zprj or exported .glb/.gltf from CLO 3D. Highest fidelity — real-time cloth physics, true-to-life virtual try-on.",
    icon: "🧊",
    pipelineTime: "~2 min",
    recommended: true,
  },
  {
    id: "pattern",
    label: "Pattern Files",
    description: "Upload flat pattern pieces (.dxf, .ai, .svg). Our pipeline derives 3D geometry from 2D patterns.",
    icon: "📐",
    pipelineTime: "~5 min",
  },
  {
    id: "photos",
    label: "Reference Photos",
    description: "Upload product photography. We generate an approximate 3D model — lower accuracy than CLO or patterns.",
    icon: "📷",
    pipelineTime: "~8 min",
  },
  {
    id: "measurements",
    label: "Measurements Only",
    description: "No 3D model — fit engine uses your measurements + size chart data to recommend sizes. Good for simple styles.",
    icon: "📏",
    pipelineTime: "Instant",
  },
];

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function NewGarmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [createdGarment, setCreatedGarment] = useState<GarmentSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [physicsLoading, setPhysicsLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, "pending" | "uploading" | "done" | "error">>({});

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function markComplete(s: Step) {
    setCompletedSteps((prev) => new Set([...prev, s]));
  }

  // ── Step 1 validation ──────────────────────
  function validateBasics(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.category) newErrors.category = "Category is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Fabric physics auto-detect ─────────────
  async function detectPhysics() {
    if (!form.fabricComposition.trim()) return;
    setPhysicsLoading(true);
    try {
      const res = await fetch("/api/v1/fabrics/physics", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ composition: form.fabricComposition }),
      });
      if (!res.ok) throw new Error("Failed");
      const physics = (await res.json()) as FabricPhysics;
      setForm((f) => ({ ...f, physics, physicsCustomised: false }));
    } catch {
      // Leave sliders as-is
    } finally {
      setPhysicsLoading(false);
    }
  }

  // ── Create garment (end of step 3) ────────
  async function createGarment() {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
      };
      if (form.season) body["season"] = form.season;
      if (form.sku.trim()) body["sku"] = form.sku.trim();
      if (form.description.trim()) body["description"] = form.description.trim();
      if (form.fabricComposition.trim()) body["fabricComposition"] = form.fabricComposition.trim();
      if (form.uploadMethod) body["uploadMethod"] = form.uploadMethod;

      // Measurements
      const meas: Record<string, number> = {};
      if (form.chest) meas["chest"] = parseFloat(form.chest);
      if (form.waist) meas["waist"] = parseFloat(form.waist);
      if (form.hem) meas["hem"] = parseFloat(form.hem);
      if (form.sleeveLength) meas["sleeveLength"] = parseFloat(form.sleeveLength);
      if (form.totalLength) meas["totalLength"] = parseFloat(form.totalLength);
      if (form.shoulderWidth) meas["shoulderWidth"] = parseFloat(form.shoulderWidth);
      if (form.measurementNotes.trim()) meas["notes"] = parseFloat(form.measurementNotes) || 0;
      if (Object.keys(meas).length > 0) body["measurements"] = meas;

      // Always include physics if composition was set
      if (form.fabricComposition.trim()) {
        body["fabricPhysics"] = form.physics;
      }

      const res = await fetch("/api/v1/garments", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? "Failed to create garment");
      }

      const garment = (await res.json()) as GarmentSummary;
      setCreatedGarment(garment);
      markComplete("measurements");
      setStep("upload");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  // ── File upload ────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setUploadFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !existing.has(f.name))];
    });
  }, []);

  function removeFile(name: string) {
    setUploadFiles((f) => f.filter((x) => x.name !== name));
    setUploadProgress((p) => {
      const next = { ...p };
      delete next[name];
      return next;
    });
  }

  async function uploadAllFiles() {
    if (!createdGarment || uploadFiles.length === 0) {
      markComplete("upload");
      setStep("done");
      return;
    }
    setUploading(true);
    const init: Record<string, "pending" | "uploading" | "done" | "error"> = {};
    for (const f of uploadFiles) init[f.name] = "pending";
    setUploadProgress(init);

    for (const file of uploadFiles) {
      setUploadProgress((p) => ({ ...p, [file.name]: "uploading" }));
      try {
        // In production: get presigned S3 URL, upload directly, then notify API.
        // For now: POST file metadata to /api/v1/garments/:ugi/files as JSON
        // (the API records the upload and stores metadata).
        const body = {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          s3Key: `garments/${createdGarment.ugi}/${Date.now()}-${file.name}`,
          s3Url: `https://cdn.loocbooc.com/garments/${createdGarment.ugi}/${file.name}`,
        };
        const res = await fetch(`/api/v1/garments/${createdGarment.ugi}/files`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        setUploadProgress((p) => ({ ...p, [file.name]: res.ok ? "done" : "error" }));
      } catch {
        setUploadProgress((p) => ({ ...p, [file.name]: "error" }));
      }
    }
    setUploading(false);
    markComplete("upload");
    setStep("done");
  }

  // ── Navigation ─────────────────────────────
  function goNext() {
    if (step === "basics") {
      if (!validateBasics()) return;
      markComplete("basics");
      setStep("fabric");
    } else if (step === "fabric") {
      markComplete("fabric");
      setStep("measurements");
    } else if (step === "measurements") {
      void createGarment();
    } else if (step === "upload") {
      void uploadAllFiles();
    }
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0 && step !== "done") setStep(STEPS[idx - 1]!);
  }

  const isFirstStep = step === "basics";
  const isLastContentStep = step === "upload";
  const showNav = step !== "done";

  // ── File size helper ───────────────────────
  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "32px 40px", maxWidth: 760, minHeight: "100vh", background: "#fafafa" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 13, color: "#888" }}>
        <Link href="/garments" style={{ color: "#888", textDecoration: "none" }}>Garment Library</Link>
        <span>/</span>
        <span style={{ color: "#1a1a1a" }}>Add Garment</span>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24, color: "#1a1a1a", margin: "0 0 6px" }}>Add a Garment</h1>
        <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
          Enter your style details to start the 3D pipeline.
        </p>
      </div>

      {/* Step indicator */}
      {step !== "done" && (
        <StepIndicator current={step} completed={completedSteps} />
      )}

      {/* Card */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 14,
        padding: "32px 36px",
        marginBottom: 24,
      }}>

        {/* ── STEP 1: BASICS ── */}
        {step === "basics" && (
          <>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: "#1a1a1a", margin: "0 0 24px" }}>Style basics</h2>

            <Field label="Garment name" required error={errors.name}>
              <input
                type="text"
                placeholder="e.g. Linen Blazer, Silk Midi Dress"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                style={inputStyle}
                autoFocus
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Category" required error={errors.category}>
                <select value={form.category} onChange={(e) => update("category", e.target.value as Category)} style={selectStyle}>
                  <option value="">Select category</option>
                  {[
                    ["tops", "Tops"], ["bottoms", "Bottoms"], ["dresses", "Dresses"],
                    ["outerwear", "Outerwear"], ["suits", "Suits"], ["activewear", "Activewear"],
                    ["swimwear", "Swimwear"], ["underwear", "Underwear"], ["accessories", "Accessories"],
                    ["footwear", "Footwear"], ["bags", "Bags"], ["hats", "Hats"], ["other", "Other"],
                  ].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>

              <Field label="Season">
                <select value={form.season} onChange={(e) => update("season", e.target.value as Season)} style={selectStyle}>
                  <option value="">—</option>
                  <option value="SS">SS (Spring/Summer)</option>
                  <option value="AW">AW (Autumn/Winter)</option>
                  <option value="all-season">All Season</option>
                  <option value="resort">Resort</option>
                </select>
              </Field>
            </div>

            <Field label="Style code / SKU" hint="Your internal reference number. Optional.">
              <input
                type="text"
                placeholder="e.g. CC-2024-001"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Description" hint="Brief description of the style — fabric, silhouette, key features.">
              <textarea
                placeholder="Relaxed-fit silk midi dress with draped neckline…"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                style={textareaStyle}
                rows={3}
              />
            </Field>
          </>
        )}

        {/* ── STEP 2: FABRIC ── */}
        {step === "fabric" && (
          <>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: "#1a1a1a", margin: "0 0 6px" }}>Fabric composition</h2>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 24px" }}>
              Tell us what it's made of. We'll derive realistic physics for virtual try-on.
            </p>

            <Field label="Composition" hint="e.g. 85% Linen, 15% Cotton — or 100% Silk">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="100% Silk, 80% Polyester 20% Elastane…"
                  value={form.fabricComposition}
                  onChange={(e) => update("fabricComposition", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => void detectPhysics()}
                  disabled={physicsLoading || !form.fabricComposition.trim()}
                  style={{
                    padding: "10px 16px",
                    background: "#1a1a1a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: physicsLoading || !form.fabricComposition.trim() ? "default" : "pointer",
                    opacity: physicsLoading || !form.fabricComposition.trim() ? 0.5 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {physicsLoading ? "Detecting…" : "Auto-detect"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#aaa", margin: "4px 0 0" }}>
                Click Auto-detect to derive fabric physics from your composition string.
              </p>
            </Field>

            <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 24, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a", margin: "0 0 2px" }}>Fabric physics</h3>
                  <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                    {form.physicsCustomised ? "Manually adjusted" : "Auto-derived from composition"}
                  </p>
                </div>
              </div>

              <PhysicsSlider
                label="Drape"
                description="How much the fabric hangs and flows. High = fluid (silk). Low = structured (denim)."
                value={form.physics.drape}
                onChange={(v) => { update("physics", { ...form.physics, drape: v }); update("physicsCustomised", true); }}
              />
              <PhysicsSlider
                label="Stretch"
                description="Elasticity of the fabric. High = stretchy (jersey, spandex). Low = rigid (woven)."
                value={form.physics.stretch}
                onChange={(v) => { update("physics", { ...form.physics, stretch: v }); update("physicsCustomised", true); }}
              />
              <PhysicsSlider
                label="Weight"
                description="Fabric weight per square metre. High = heavy (wool coat). Low = sheer (chiffon)."
                value={form.physics.weight}
                onChange={(v) => { update("physics", { ...form.physics, weight: v }); update("physicsCustomised", true); }}
              />
              <PhysicsSlider
                label="Breathability"
                description="Air permeability. High = breathable (linen). Low = dense (leather)."
                value={form.physics.breathability}
                onChange={(v) => { update("physics", { ...form.physics, breathability: v }); update("physicsCustomised", true); }}
              />
              <PhysicsSlider
                label="Sheen"
                description="Surface reflectivity. High = glossy (satin). Low = matte (cotton jersey)."
                value={form.physics.sheen}
                onChange={(v) => { update("physics", { ...form.physics, sheen: v }); update("physicsCustomised", true); }}
              />
            </div>
          </>
        )}

        {/* ── STEP 3: MEASUREMENTS ── */}
        {step === "measurements" && (
          <>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: "#1a1a1a", margin: "0 0 6px" }}>Sample measurements</h2>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 8px" }}>
              Size 10 (AU) / size 6 (US) measurements in centimetres. Used by the Fit Engine to recommend sizes to consumers.
            </p>
            <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 24px" }}>
              All fields optional — you can add measurements later from the garment page.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { key: "chest" as const, label: "Chest / Bust", placeholder: "e.g. 88" },
                { key: "waist" as const, label: "Waist", placeholder: "e.g. 68" },
                { key: "hem" as const, label: "Hem circumference", placeholder: "e.g. 100" },
                { key: "totalLength" as const, label: "Total length", placeholder: "e.g. 120" },
                { key: "sleeveLength" as const, label: "Sleeve length", placeholder: "e.g. 60" },
                { key: "shoulderWidth" as const, label: "Shoulder width", placeholder: "e.g. 38" },
              ].map((field) => (
                <Field key={field.key} label={field.label}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => update(field.key, e.target.value)}
                      style={{ ...inputStyle, paddingRight: 36 }}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#bbb" }}>cm</span>
                  </div>
                </Field>
              ))}
            </div>

            <Field label="Measurement notes">
              <textarea
                placeholder="Any notes about the sample or measurement methodology…"
                value={form.measurementNotes}
                onChange={(e) => update("measurementNotes", e.target.value)}
                style={textareaStyle}
                rows={2}
              />
            </Field>

            {saveError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 14, marginTop: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#991b1b", fontWeight: 500 }}>
                  Error creating garment: {saveError}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── STEP 4: UPLOAD ── */}
        {step === "upload" && createdGarment && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✅</div>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 18, color: "#1a1a1a", margin: 0 }}>Garment created</h2>
                <p style={{ fontSize: 12, fontFamily: "monospace", color: "#888", margin: "2px 0 0" }}>UGI: {createdGarment.ugi}</p>
              </div>
            </div>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 24px" }}>
              Now upload your design files to start the 3D pipeline. You can skip this and upload later.
            </p>

            {/* Upload method */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#1a1a1a", marginBottom: 12 }}>
                Upload method
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {UPLOAD_METHODS.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => update("uploadMethod", m.id)}
                    style={{
                      border: form.uploadMethod === m.id ? "2px solid #1a1a1a" : "1px solid #e5e5e5",
                      borderRadius: 10,
                      padding: "14px 16px",
                      cursor: "pointer",
                      background: form.uploadMethod === m.id ? "#1a1a1a08" : "#fff",
                      transition: "border-color 0.15s ease",
                      position: "relative",
                    }}
                  >
                    {m.recommended && (
                      <span style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "2px 6px",
                        borderRadius: 20,
                      }}>Recommended</span>
                    )}
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a1a", marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 8 }}>{m.description}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>⏱ {m.pipelineTime}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* File drop zone */}
            {form.uploadMethod && form.uploadMethod !== "measurements" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#1a1a1a", marginBottom: 10 }}>
                  Files
                </label>
                <label style={{
                  display: "block",
                  border: "2px dashed #e5e5e5",
                  borderRadius: 10,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#fafafa",
                  transition: "border-color 0.15s ease",
                }}
                  onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLLabelElement).style.borderColor = "#1a1a1a"; }}
                  onDragLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.borderColor = "#e5e5e5"; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLLabelElement).style.borderColor = "#e5e5e5";
                    const files = Array.from(e.dataTransfer.files);
                    setUploadFiles((prev) => {
                      const existing = new Set(prev.map((f) => f.name));
                      return [...prev, ...files.filter((f) => !existing.has(f.name))];
                    });
                  }}
                >
                  <input
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    accept={
                      form.uploadMethod === "clo3d" ? ".glb,.gltf,.zprj,.obj" :
                      form.uploadMethod === "pattern" ? ".dxf,.ai,.svg,.pdf" :
                      form.uploadMethod === "photos" ? "image/*" : ""
                    }
                    onChange={handleFileChange}
                  />
                  <p style={{ fontSize: 14, color: "#888", margin: "0 0 4px" }}>
                    {form.uploadMethod === "clo3d" && "Drop .glb, .gltf, or .zprj files here"}
                    {form.uploadMethod === "pattern" && "Drop .dxf, .ai, .svg, or .pdf pattern files here"}
                    {form.uploadMethod === "photos" && "Drop product photos here"}
                  </p>
                  <p style={{ fontSize: 12, color: "#bbb", margin: 0 }}>or click to browse</p>
                </label>
              </div>
            )}

            {/* File list */}
            {uploadFiles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {uploadFiles.map((f) => {
                  const state = uploadProgress[f.name] ?? "pending";
                  return (
                    <div key={f.name} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: "#f9f9f9",
                      borderRadius: 8,
                      marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 16 }}>
                        {state === "done" ? "✅" : state === "error" ? "❌" : state === "uploading" ? "⏳" : "📄"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: "#aaa" }}>{fmtBytes(f.size)}</div>
                      </div>
                      {!uploading && state !== "done" && (
                        <button
                          onClick={() => removeFile(f.name)}
                          style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16, padding: 0 }}
                        >×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── STEP 5: DONE ── */}
        {step === "done" && createdGarment && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontWeight: 700, fontSize: 22, color: "#1a1a1a", margin: "0 0 8px" }}>Garment added!</h2>
            <p style={{ color: "#888", fontSize: 15, margin: "0 0 6px" }}>
              <strong>{form.name}</strong> has been created.
            </p>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa", marginBottom: 28 }}>
              UGI: {createdGarment.ugi}
            </div>

            {uploadFiles.length > 0 && Object.values(uploadProgress).some((s) => s === "done") && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 16, marginBottom: 24, textAlign: "left" }}>
                <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 14, color: "#166534" }}>🔄 3D pipeline started</p>
                <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>
                  Your files are in the queue. The garment card will update to "Active" when processing is complete. Check the garment page for real-time status.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={`/garments/${createdGarment.ugi}`} style={{
                background: "#1a1a1a",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}>
                View garment
              </Link>
              <Link href="/campaigns/new" style={{
                background: "#fff",
                color: "#1a1a1a",
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                border: "1px solid #e5e5e5",
              }}>
                Create a Back It campaign →
              </Link>
              <Link href="/garments/new" style={{
                background: "#fff",
                color: "#888",
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                border: "1px solid #e5e5e5",
              }}>
                Add another garment
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {showNav && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Back */}
          {!isFirstStep && step !== "upload" ? (
            <button
              onClick={goBack}
              style={{
                padding: "11px 20px",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                background: "#fff",
                color: "#888",
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          ) : <div />}

          {/* Skip (upload step) */}
          {step === "upload" && (
            <button
              onClick={() => { markComplete("upload"); setStep("done"); }}
              style={{
                padding: "11px 20px",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                background: "#fff",
                color: "#888",
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Skip for now
            </button>
          )}

          {/* Next / Submit */}
          <button
            onClick={goNext}
            disabled={saving || uploading}
            style={{
              padding: "11px 24px",
              border: "none",
              borderRadius: 8,
              background: "#1a1a1a",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: saving || uploading ? "default" : "pointer",
              opacity: saving || uploading ? 0.6 : 1,
            }}
          >
            {saving ? "Creating…" :
             uploading ? "Uploading…" :
             step === "measurements" ? "Create garment →" :
             step === "upload" && uploadFiles.length > 0 ? `Upload ${uploadFiles.length} file${uploadFiles.length !== 1 ? "s" : ""} →` :
             step === "upload" ? "Continue →" :
             "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
