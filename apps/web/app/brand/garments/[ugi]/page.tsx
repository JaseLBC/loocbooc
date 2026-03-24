/**
 * Garment Detail — /garments/:ugi
 *
 * Full view of a single garment. Shows all metadata, fabric physics,
 * measurements, pipeline status, and assets. Inline editing for key fields.
 *
 * Sections:
 * 1. Header — name, UGI, status badge, actions (Edit, Create Campaign, Archive)
 * 2. Overview — category, season, SKU, description, created date
 * 3. 3D Pipeline status — stage-by-stage progress, estimated time remaining
 * 4. Fabric physics — bar chart of physics values (drape, stretch, weight, …)
 * 5. Measurements — sample measurements table, editable
 * 6. Files — list of uploaded assets with type, size, upload date
 * 7. Linked campaigns — any Back It campaigns using this garment
 *
 * Edit mode: individual sections unlock inline. PATCH /api/v1/garments/:ugi
 * File upload: drag-drop zone calls POST /api/v1/garments/:ugi/files
 * Pipeline poll: GET /api/v1/garments/:ugi/scan/status (auto-polls if processing)
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type GarmentStatus = "draft" | "processing" | "active" | "updating" | "error" | "archived";

interface FabricPhysics {
  drape: number;
  stretch: number;
  weight: number;
  breathability: number;
  sheen: number;
}

interface Measurements {
  chest?: number;
  waist?: number;
  hem?: number;
  sleeveLength?: number;
  totalLength?: number;
  shoulderWidth?: number;
  notes?: string;
}

interface PipelineStage {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
  progress?: number;
  detail?: string;
}

interface ScanStatus {
  ugi: string;
  status: string;
  stages: PipelineStage[];
  estimatedSecondsRemaining?: number;
  errorMessage?: string;
}

interface GarmentDetail {
  ugi: string;
  id: string;
  brandId: string;
  name: string;
  category: string | null;
  season: string | null;
  sku: string | null;
  description: string | null;
  fabricComposition: string | null;
  fabricPhysics: FabricPhysics | null;
  measurements: Measurements | null;
  uploadMethod: string | null;
  status: GarmentStatus;
  hasModel3D: boolean;
  thumbnailUrl: string | null;
  modelUrl: string | null;
  usdzUrl: string | null;
  tryOnCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function statusBadge(status: GarmentStatus): { label: string; bg: string; color: string } {
  const map: Record<GarmentStatus, { label: string; bg: string; color: string }> = {
    draft: { label: "Draft", bg: "#f5f5f5", color: "#666" },
    processing: { label: "Processing", bg: "#fef9c3", color: "#854d0e" },
    active: { label: "Active", bg: "#dcfce7", color: "#166534" },
    updating: { label: "Updating", bg: "#fef9c3", color: "#854d0e" },
    error: { label: "Error", bg: "#fee2e2", color: "#991b1b" },
    archived: { label: "Archived", bg: "#f5f5f5", color: "#999" },
  };
  return map[status];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

const CATEGORY_LABELS: Record<string, string> = {
  tops: "Tops", bottoms: "Bottoms", dresses: "Dresses", outerwear: "Outerwear",
  suits: "Suits", activewear: "Activewear", swimwear: "Swimwear", underwear: "Underwear",
  accessories: "Accessories", footwear: "Footwear", bags: "Bags", hats: "Hats", other: "Other",
};

const PHYSICS_LABELS: Array<{ key: keyof FabricPhysics; label: string; lowLabel: string; highLabel: string }> = [
  { key: "drape", label: "Drape", lowLabel: "Structured", highLabel: "Fluid" },
  { key: "stretch", label: "Stretch", lowLabel: "Rigid", highLabel: "Elastic" },
  { key: "weight", label: "Weight", lowLabel: "Sheer", highLabel: "Heavy" },
  { key: "breathability", label: "Breathability", lowLabel: "Dense", highLabel: "Airy" },
  { key: "sheen", label: "Sheen", lowLabel: "Matte", highLabel: "Glossy" },
];

// ─────────────────────────────────────────────
// Physics bar
// ─────────────────────────────────────────────

function PhysicsBar({ value, label, lowLabel, highLabel }: { value: number; label: string; lowLabel: string; highLabel: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: "#1a1a1a", borderRadius: 4, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 11, color: "#bbb" }}>{lowLabel}</span>
        <span style={{ fontSize: 11, color: "#bbb" }}>{highLabel}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pipeline status
// ─────────────────────────────────────────────

function PipelineStatusBlock({ scan, loading }: { scan: ScanStatus | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ padding: "16px", background: "#f9f9f9", borderRadius: 10, textAlign: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid #ddd", borderTopColor: "#1a1a1a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Loading pipeline status…</p>
      </div>
    );
  }

  if (!scan || scan.status === "idle") {
    return (
      <div style={{ padding: "16px", background: "#f9f9f9", borderRadius: 10, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>Pipeline not started. Upload files to begin.</p>
      </div>
    );
  }

  return (
    <div>
      {scan.status === "complete" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#166534" }}>3D pipeline complete — garment is active</span>
        </div>
      )}
      {scan.status === "error" && (
        <div style={{ padding: "12px 16px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: "#991b1b", margin: "0 0 4px" }}>Pipeline error</p>
          <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>{scan.errorMessage ?? "An error occurred during processing."}</p>
        </div>
      )}
      {scan.status === "running" && scan.estimatedSecondsRemaining != null && (
        <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
          ⏱ Est. {scan.estimatedSecondsRemaining < 60
            ? `${scan.estimatedSecondsRemaining}s`
            : `${Math.ceil(scan.estimatedSecondsRemaining / 60)}m`} remaining
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {scan.stages.map((stage) => (
          <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              flexShrink: 0,
              background: stage.status === "complete" ? "#dcfce7" : stage.status === "running" ? "#fef9c3" : stage.status === "error" ? "#fee2e2" : "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}>
              {stage.status === "complete" ? "✓" : stage.status === "error" ? "✗" : stage.status === "running" ? "⟳" : "○"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: stage.status === "running" ? 600 : 400, color: stage.status === "pending" ? "#bbb" : "#1a1a1a" }}>
                  {stage.label}
                </span>
                {stage.status === "running" && stage.progress != null && (
                  <span style={{ fontSize: 12, color: "#888" }}>{stage.progress}%</span>
                )}
              </div>
              {stage.status === "running" && stage.progress != null && (
                <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${stage.progress}%`, background: "#1a1a1a", transition: "width 0.3s ease" }} />
                </div>
              )}
              {stage.detail && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{stage.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  fontSize: 13,
  color: "#1a1a1a",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box" as const,
};

// ─────────────────────────────────────────────
// Measurements editor
// ─────────────────────────────────────────────

function MeasurementsEditor({
  measurements,
  editing,
  onSave,
  onCancel,
  onChange,
}: {
  measurements: Measurements | null;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onChange: (m: Measurements) => void;
}) {
  const fields: Array<{ key: keyof Measurements; label: string }> = [
    { key: "chest", label: "Chest / Bust (cm)" },
    { key: "waist", label: "Waist (cm)" },
    { key: "hem", label: "Hem (cm)" },
    { key: "totalLength", label: "Total Length (cm)" },
    { key: "sleeveLength", label: "Sleeve Length (cm)" },
    { key: "shoulderWidth", label: "Shoulder Width (cm)" },
  ];

  const hasMeasurements = measurements && Object.keys(measurements).some(
    (k) => k !== "notes" && measurements[k as keyof Measurements] != null
  );

  if (!editing && !hasMeasurements) {
    return (
      <p style={{ fontSize: 13, color: "#bbb", margin: 0 }}>No measurements recorded. Click Edit to add them.</p>
    );
  }

  if (!editing) {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {fields.map((f) => {
            const val = measurements?.[f.key];
            if (val == null || typeof val === "string") return null;
            return (
              <tr key={f.key}>
                <td style={{ padding: "6px 0", fontSize: 13, color: "#888", width: 180 }}>{f.label}</td>
                <td style={{ padding: "6px 0", fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{val} cm</td>
              </tr>
            );
          })}
          {measurements?.notes && (
            <tr>
              <td colSpan={2} style={{ padding: "8px 0 0", fontSize: 13, color: "#888" }}>
                Notes: {measurements.notes}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>{f.label}</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={typeof measurements?.[f.key] === "number" ? String(measurements[f.key]) : ""}
                onChange={(e) => onChange({ ...(measurements ?? {}), [f.key]: e.target.value ? parseFloat(e.target.value) : undefined })}
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#bbb" }}>cm</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Notes</label>
        <input
          type="text"
          placeholder="Any notes about these measurements…"
          value={measurements?.notes ?? ""}
          onChange={(e) => onChange({ ...(measurements ?? {}), notes: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={{
          padding: "8px 18px", background: "#1a1a1a", color: "#fff", border: "none",
          borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>Save measurements</button>
        <button onClick={onCancel} style={{
          padding: "8px 18px", background: "#f5f5f5", color: "#666", border: "none",
          borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: "pointer",
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function GarmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ugi = params["ugi"] as string;

  const [garment, setGarment] = useState<GarmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pipeline
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Editing
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFabricComposition, setEditFabricComposition] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editMeasurements, setEditMeasurements] = useState<Measurements | null>(null);

  // Files
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState<string[]>([]);

  // Archive confirm
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchGarment = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/v1/garments/${ugi}`, { headers: authHeaders() });
      if (res.status === 404) { setLoadError("Garment not found."); return; }
      if (!res.ok) throw new Error("Failed to load garment");
      const data = (await res.json()) as GarmentDetail;
      setGarment(data);
      setEditName(data.name);
      setEditDescription(data.description ?? "");
      setEditFabricComposition(data.fabricComposition ?? "");
      setEditSku(data.sku ?? "");
      setEditMeasurements(data.measurements ?? null);
    } catch {
      setLoadError("Failed to load garment.");
    } finally {
      setLoading(false);
    }
  }, [ugi]);

  const fetchScanStatus = useCallback(async () => {
    setScanLoading(true);
    try {
      const res = await fetch(`/api/v1/garments/${ugi}/scan/status`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as ScanStatus;
      setScan(data);
      // Stop polling if complete or error
      if (data.status === "complete" || data.status === "error") {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch { /* ignore */ } finally {
      setScanLoading(false);
    }
  }, [ugi]);

  useEffect(() => {
    void fetchGarment();
    void fetchScanStatus();
  }, [fetchGarment, fetchScanStatus]);

  // Poll scan status when processing
  useEffect(() => {
    if (!garment) return;
    if (garment.status === "processing" || garment.status === "updating") {
      pollRef.current = setInterval(() => { void fetchScanStatus(); }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [garment?.status, fetchScanStatus]);

  // ── Save info ──────────────────────────────
  async function saveInfo() {
    if (!garment) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editName.trim() !== garment.name) body["name"] = editName.trim();
      if (editDescription !== (garment.description ?? "")) body["description"] = editDescription;
      if (editFabricComposition !== (garment.fabricComposition ?? "")) body["fabricComposition"] = editFabricComposition;
      if (editSku !== (garment.sku ?? "")) body["sku"] = editSku;

      if (Object.keys(body).length === 0) { setEditingInfo(false); return; }

      const res = await fetch(`/api/v1/garments/${ugi}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? "Save failed");
      }
      const updated = (await res.json()) as GarmentDetail;
      setGarment(updated);
      setEditingInfo(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Save measurements ──────────────────────
  async function saveMeasurements() {
    if (!garment) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/v1/garments/${ugi}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ measurements: editMeasurements ?? {} }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? "Save failed");
      }
      const updated = (await res.json()) as GarmentDetail;
      setGarment(updated);
      setEditingMeasurements(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Archive ────────────────────────────────
  async function archiveGarment() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/garments/${ugi}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error("Archive failed");
      router.push("/garments");
    } catch {
      setShowArchiveConfirm(false);
    } finally {
      setArchiving(false);
    }
  }

  // ── File upload ────────────────────────────
  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function uploadFiles_fn() {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    const done: string[] = [];
    for (const file of uploadFiles) {
      try {
        const body = {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          s3Key: `garments/${ugi}/${Date.now()}-${file.name}`,
          s3Url: `https://cdn.loocbooc.com/garments/${ugi}/${file.name}`,
        };
        const res = await fetch(`/api/v1/garments/${ugi}/files`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) done.push(file.name);
      } catch { /* skip */ }
    }
    setUploadDone(done);
    setUploadFiles([]);
    setUploading(false);
    // Refresh garment and pipeline
    void fetchGarment();
    void fetchScanStatus();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "32px 40px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #e5e5e5", borderTopColor: "#1a1a1a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loadError || !garment) {
    return (
      <div style={{ padding: "32px 40px", textAlign: "center" }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>😕</p>
        <h2 style={{ fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>{loadError ?? "Something went wrong"}</h2>
        <Link href="/garments" style={{ color: "#888", fontSize: 14 }}>← Back to Garment Library</Link>
      </div>
    );
  }

  const badge = statusBadge(garment.status);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, minHeight: "100vh", background: "#fafafa" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "#888" }}>
        <Link href="/garments" style={{ color: "#888", textDecoration: "none" }}>Garment Library</Link>
        <span>/</span>
        <span style={{ color: "#1a1a1a" }}>{garment.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "#1a1a1a", margin: 0 }}>{garment.name}</h1>
            <span style={{
              background: badge.bg, color: badge.color,
              fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
            }}>{badge.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#888" }}>
            <span style={{ fontFamily: "monospace", background: "#f5f5f5", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{garment.ugi}</span>
            {garment.category && <span>{CATEGORY_LABELS[garment.category] ?? garment.category}</span>}
            {garment.season && <span>{garment.season}</span>}
            {garment.sku && <span>#{garment.sku}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {saveSuccess && (
            <span style={{ fontSize: 13, color: "#166534", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>✓ Saved</span>
          )}
          {garment.status !== "archived" && (
            <Link href="/campaigns/new" style={{
              padding: "9px 16px",
              background: "#1a1a1a",
              color: "#fff",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}>
              Create Campaign →
            </Link>
          )}
          {garment.status !== "archived" && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              style={{
                padding: "9px 14px",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                background: "#fff",
                color: "#888",
                fontSize: 13,
                cursor: "pointer",
              }}
            >Archive</button>
          )}
        </div>
      </div>

      {/* Archive confirm */}
      {showArchiveConfirm && (
        <div style={{
          background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 20,
          marginBottom: 16,
        }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", margin: "0 0 8px" }}>
            Archive this garment?
          </p>
          <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>
            The garment will be hidden from your library. Any linked campaigns are unaffected.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => void archiveGarment()}
              disabled={archiving}
              style={{ padding: "8px 18px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: archiving ? "default" : "pointer" }}
            >
              {archiving ? "Archiving…" : "Archive"}
            </button>
            <button
              onClick={() => setShowArchiveConfirm(false)}
              style={{ padding: "8px 18px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#991b1b" }}>Error: {saveError}</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div>

          {/* Info section */}
          <Section
            title="Details"
            action={
              editingInfo ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => void saveInfo()} disabled={saving} style={{ padding: "6px 14px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: saving ? "default" : "pointer" }}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setEditingInfo(false); setEditName(garment.name); setEditDescription(garment.description ?? ""); setEditFabricComposition(garment.fabricComposition ?? ""); setEditSku(garment.sku ?? ""); }} style={{ padding: "6px 12px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 7, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditingInfo(true)} style={{ padding: "6px 14px", border: "1px solid #e5e5e5", borderRadius: 7, background: "#fff", color: "#666", fontSize: 12, cursor: "pointer" }}>Edit</button>
              )
            }
          >
            {editingInfo ? (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Description</label>
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} rows={3} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Fabric composition</label>
                    <input type="text" value={editFabricComposition} onChange={(e) => setEditFabricComposition(e.target.value)} placeholder="100% Silk…" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 4 }}>Style code / SKU</label>
                    <input type="text" value={editSku} onChange={(e) => setEditSku(e.target.value)} placeholder="CC-2024-001" style={inputStyle} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {garment.description && (
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: "0 0 16px" }}>{garment.description}</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Category", value: garment.category ? CATEGORY_LABELS[garment.category] ?? garment.category : null },
                    { label: "Season", value: garment.season },
                    { label: "Style code", value: garment.sku },
                    { label: "Fabric", value: garment.fabricComposition },
                    { label: "Upload method", value: garment.uploadMethod },
                    { label: "Created", value: fmtDate(garment.createdAt) },
                    { label: "Updated", value: fmtRelative(garment.updatedAt) },
                    { label: "Try-ons", value: garment.tryOnCount > 0 ? `${garment.tryOnCount.toLocaleString()}` : null },
                  ].filter((x) => x.value != null).map((x) => (
                    <div key={x.label}>
                      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>{x.label}</div>
                      <div style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>{x.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Measurements */}
          <Section
            title="Sample measurements"
            action={
              !editingMeasurements ? (
                <button onClick={() => setEditingMeasurements(true)} style={{ padding: "6px 14px", border: "1px solid #e5e5e5", borderRadius: 7, background: "#fff", color: "#666", fontSize: 12, cursor: "pointer" }}>Edit</button>
              ) : undefined
            }
          >
            <MeasurementsEditor
              measurements={editMeasurements}
              editing={editingMeasurements}
              onSave={() => void saveMeasurements()}
              onCancel={() => { setEditingMeasurements(false); setEditMeasurements(garment.measurements ?? null); }}
              onChange={setEditMeasurements}
            />
          </Section>

          {/* File upload */}
          <Section title="Design files">
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>
              Upload CLO 3D files, patterns, or photos to start or update the 3D pipeline.
            </p>

            {/* Drop zone */}
            <label style={{
              display: "block",
              border: "2px dashed #e5e5e5",
              borderRadius: 10,
              padding: "24px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: "#fafafa",
              marginBottom: uploadFiles.length > 0 ? 12 : 0,
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
                accept=".glb,.gltf,.zprj,.obj,.dxf,.ai,.svg,.pdf,image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setUploadFiles((prev) => {
                    const existing = new Set(prev.map((f) => f.name));
                    return [...prev, ...files.filter((f) => !existing.has(f.name))];
                  });
                }}
              />
              <p style={{ fontSize: 14, color: "#aaa", margin: "0 0 4px" }}>Drop files here or click to browse</p>
              <p style={{ fontSize: 12, color: "#ccc", margin: 0 }}>GLB, GLTF, ZPRJ, DXF, AI, SVG, PDF, or images</p>
            </label>

            {/* File list */}
            {uploadFiles.map((f) => (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f9f9f9", borderRadius: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{fmtBytes(f.size)}</div>
                </div>
                <button onClick={() => setUploadFiles((prev) => prev.filter((x) => x.name !== f.name))} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            ))}

            {uploadFiles.length > 0 && (
              <button
                onClick={() => void uploadFiles_fn()}
                disabled={uploading}
                style={{
                  marginTop: 8,
                  padding: "9px 18px",
                  background: "#1a1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: uploading ? "default" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? "Uploading…" : `Upload ${uploadFiles.length} file${uploadFiles.length !== 1 ? "s" : ""}`}
              </button>
            )}

            {uploadDone.length > 0 && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>
                  ✅ {uploadDone.length} file{uploadDone.length !== 1 ? "s" : ""} uploaded. Pipeline update triggered.
                </p>
              </div>
            )}
          </Section>

        </div>

        {/* Right column */}
        <div>

          {/* Stats */}
          <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Try-ons", value: garment.tryOnCount.toLocaleString() },
                { label: "3D model", value: garment.hasModel3D ? "✅ Ready" : "—" },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3D Pipeline */}
          <Section title="3D Pipeline">
            <PipelineStatusBlock scan={scan} loading={scanLoading && !scan} />
          </Section>

          {/* Fabric physics */}
          {garment.fabricPhysics && (
            <Section title="Fabric physics">
              {PHYSICS_LABELS.map((p) => (
                <PhysicsBar
                  key={p.key}
                  value={garment.fabricPhysics![p.key]}
                  label={p.label}
                  lowLabel={p.lowLabel}
                  highLabel={p.highLabel}
                />
              ))}
            </Section>
          )}

          {/* Quick actions */}
          <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", margin: "0 0 14px" }}>Quick actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/campaigns/new" style={{
                display: "block", padding: "9px 14px", background: "#1a1a1a", color: "#fff",
                borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: "none", textAlign: "center",
              }}>Create Back It campaign</Link>
              <Link href="/plm" style={{
                display: "block", padding: "9px 14px", border: "1px solid #e5e5e5", color: "#666",
                borderRadius: 8, fontWeight: 500, fontSize: 13, textDecoration: "none", textAlign: "center",
              }}>View in PLM</Link>
              <Link href="/size-charts" style={{
                display: "block", padding: "9px 14px", border: "1px solid #e5e5e5", color: "#666",
                borderRadius: 8, fontWeight: 500, fontSize: 13, textDecoration: "none", textAlign: "center",
              }}>Manage size charts</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
