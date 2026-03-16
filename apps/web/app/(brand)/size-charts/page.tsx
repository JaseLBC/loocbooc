"use client";

/**
 * Brand Size Charts — /size-charts
 *
 * Allows brands to manage the size charts that power fit recommendations
 * for their consumers. Without accurate size charts, the Fit Engine falls
 * back to the default AU standard sizing — close but not brand-specific.
 *
 * Features:
 * - List all size charts for this brand
 * - Create new size charts with:
 *     - Category (dress, top, trouser, skirt, etc.)
 *     - Size system (AU, US, EU, UK, INT)
 *     - Per-row measurement ranges (bust, waist, hips, inseam, shoulder)
 *     - Template loader (standard AU/US/EU women's sizing pre-filled)
 * - Edit existing size charts
 * - Delete size charts
 * - See which garments are using each chart (future: linked garment count)
 *
 * API:
 *   GET    /api/v1/size-charts?brandId=       — list brand's size charts
 *   POST   /api/v1/size-charts                — create size chart
 *   DELETE /api/v1/size-charts/:id            — delete size chart (not in spec, add to API)
 *
 * Data flow:
 *   Brand uploads size charts → stored in size_charts table
 *   Consumer backs a campaign → fit engine reads brand chart → recommends size
 *   Consumer avatar measurements + chart → FitScore → size recommendation displayed
 */

import React, { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SizeSystem = "AU" | "US" | "EU" | "UK" | "INT";

interface SizeChartRow {
  size: string;
  bustMin?: number;
  bustMax?: number;
  waistMin?: number;
  waistMax?: number;
  hipsMin?: number;
  hipsMax?: number;
  inseamMin?: number;
  inseamMax?: number;
  shoulderMin?: number;
  shoulderMax?: number;
  chestMin?: number;
  chestMax?: number;
}

interface SizeChart {
  id: string;
  brandId: string;
  garmentId: string | null;
  name: string;
  category: string;
  sizeSystem: SizeSystem;
  rows: SizeChartRow[];
  createdAt: string;
}

interface NewChartForm {
  name: string;
  category: string;
  sizeSystem: SizeSystem;
  rows: SizeChartRow[];
}

// ─────────────────────────────────────────────
// Category definitions
// ─────────────────────────────────────────────

const CATEGORIES = [
  { value: "dress",    label: "Dress" },
  { value: "top",      label: "Top / Blouse" },
  { value: "jacket",   label: "Jacket / Blazer" },
  { value: "coat",     label: "Coat" },
  { value: "trouser",  label: "Trouser / Pant" },
  { value: "skirt",    label: "Skirt" },
  { value: "short",    label: "Short" },
  { value: "jumpsuit", label: "Jumpsuit" },
  { value: "swimwear", label: "Swimwear" },
  { value: "knitwear", label: "Knitwear" },
];

const SIZE_SYSTEMS: { value: SizeSystem; label: string }[] = [
  { value: "AU", label: "AU (Australian)" },
  { value: "US", label: "US (American)" },
  { value: "EU", label: "EU (European)" },
  { value: "UK", label: "UK (British)" },
  { value: "INT", label: "INT (International S/M/L)" },
];

// ─────────────────────────────────────────────
// Size chart templates
// ─────────────────────────────────────────────

const TEMPLATES: Record<string, Record<string, SizeChartRow[]>> = {
  AU: {
    dress: [
      { size: "6",  bustMin: 78,  bustMax: 83,  waistMin: 60, waistMax: 65,  hipsMin: 84,  hipsMax: 89  },
      { size: "8",  bustMin: 83,  bustMax: 88,  waistMin: 65, waistMax: 70,  hipsMin: 89,  hipsMax: 94  },
      { size: "10", bustMin: 88,  bustMax: 93,  waistMin: 70, waistMax: 75,  hipsMin: 94,  hipsMax: 99  },
      { size: "12", bustMin: 93,  bustMax: 100, waistMin: 75, waistMax: 82,  hipsMin: 99,  hipsMax: 106 },
      { size: "14", bustMin: 100, bustMax: 107, waistMin: 82, waistMax: 89,  hipsMin: 106, hipsMax: 113 },
      { size: "16", bustMin: 107, bustMax: 114, waistMin: 89, waistMax: 97,  hipsMin: 113, hipsMax: 121 },
      { size: "18", bustMin: 114, bustMax: 122, waistMin: 97, waistMax: 105, hipsMin: 121, hipsMax: 130 },
      { size: "20", bustMin: 122, bustMax: 132, waistMin: 105, waistMax: 115, hipsMin: 130, hipsMax: 140 },
    ],
    top: [
      { size: "6",  bustMin: 78,  bustMax: 83,  waistMin: 60, waistMax: 65,  shoulderMin: 35, shoulderMax: 38 },
      { size: "8",  bustMin: 83,  bustMax: 88,  waistMin: 65, waistMax: 70,  shoulderMin: 37, shoulderMax: 40 },
      { size: "10", bustMin: 88,  bustMax: 93,  waistMin: 70, waistMax: 75,  shoulderMin: 38, shoulderMax: 41 },
      { size: "12", bustMin: 93,  bustMax: 100, waistMin: 75, waistMax: 82,  shoulderMin: 39, shoulderMax: 42 },
      { size: "14", bustMin: 100, bustMax: 107, waistMin: 82, waistMax: 89,  shoulderMin: 40, shoulderMax: 43 },
      { size: "16", bustMin: 107, bustMax: 114, waistMin: 89, waistMax: 97,  shoulderMin: 41, shoulderMax: 44 },
      { size: "18", bustMin: 114, bustMax: 122, waistMin: 97, waistMax: 105, shoulderMin: 42, shoulderMax: 46 },
      { size: "20", bustMin: 122, bustMax: 132, waistMin: 105, waistMax: 115, shoulderMin: 44, shoulderMax: 48 },
    ],
    trouser: [
      { size: "6",  waistMin: 60, waistMax: 65,  hipsMin: 84,  hipsMax: 89,  inseamMin: 75, inseamMax: 81 },
      { size: "8",  waistMin: 65, waistMax: 70,  hipsMin: 89,  hipsMax: 94,  inseamMin: 76, inseamMax: 82 },
      { size: "10", waistMin: 70, waistMax: 75,  hipsMin: 94,  hipsMax: 99,  inseamMin: 77, inseamMax: 83 },
      { size: "12", waistMin: 75, waistMax: 82,  hipsMin: 99,  hipsMax: 106, inseamMin: 77, inseamMax: 83 },
      { size: "14", waistMin: 82, waistMax: 89,  hipsMin: 106, hipsMax: 113, inseamMin: 78, inseamMax: 84 },
      { size: "16", waistMin: 89, waistMax: 97,  hipsMin: 113, hipsMax: 121, inseamMin: 78, inseamMax: 84 },
      { size: "18", waistMin: 97, waistMax: 105, hipsMin: 121, hipsMax: 130, inseamMin: 78, inseamMax: 84 },
      { size: "20", waistMin: 105, waistMax: 115, hipsMin: 130, hipsMax: 140, inseamMin: 78, inseamMax: 84 },
    ],
  },
  US: {
    dress: [
      { size: "0",   bustMin: 80,  bustMax: 83,  waistMin: 61, waistMax: 64,  hipsMin: 86,  hipsMax: 89  },
      { size: "2",   bustMin: 83,  bustMax: 86,  waistMin: 64, waistMax: 67,  hipsMin: 89,  hipsMax: 92  },
      { size: "4",   bustMin: 86,  bustMax: 89,  waistMin: 67, waistMax: 70,  hipsMin: 92,  hipsMax: 95  },
      { size: "6",   bustMin: 89,  bustMax: 93,  waistMin: 70, waistMax: 74,  hipsMin: 95,  hipsMax: 99  },
      { size: "8",   bustMin: 93,  bustMax: 97,  waistMin: 74, waistMax: 78,  hipsMin: 99,  hipsMax: 103 },
      { size: "10",  bustMin: 97,  bustMax: 101, waistMin: 78, waistMax: 82,  hipsMin: 103, hipsMax: 107 },
      { size: "12",  bustMin: 101, bustMax: 107, waistMin: 82, waistMax: 88,  hipsMin: 107, hipsMax: 113 },
      { size: "14",  bustMin: 107, bustMax: 113, waistMin: 88, waistMax: 94,  hipsMin: 113, hipsMax: 119 },
    ],
    trouser: [
      { size: "0",  waistMin: 61, waistMax: 64,  hipsMin: 86,  hipsMax: 89  },
      { size: "2",  waistMin: 64, waistMax: 67,  hipsMin: 89,  hipsMax: 92  },
      { size: "4",  waistMin: 67, waistMax: 70,  hipsMin: 92,  hipsMax: 95  },
      { size: "6",  waistMin: 70, waistMax: 74,  hipsMin: 95,  hipsMax: 99  },
      { size: "8",  waistMin: 74, waistMax: 78,  hipsMin: 99,  hipsMax: 103 },
      { size: "10", waistMin: 78, waistMax: 82,  hipsMin: 103, hipsMax: 107 },
      { size: "12", waistMin: 82, waistMax: 88,  hipsMin: 107, hipsMax: 113 },
      { size: "14", waistMin: 88, waistMax: 94,  hipsMin: 113, hipsMax: 119 },
    ],
  },
  EU: {
    dress: [
      { size: "32", bustMin: 78,  bustMax: 82,  waistMin: 59, waistMax: 63,  hipsMin: 84,  hipsMax: 88  },
      { size: "34", bustMin: 82,  bustMax: 86,  waistMin: 63, waistMax: 67,  hipsMin: 88,  hipsMax: 92  },
      { size: "36", bustMin: 86,  bustMax: 90,  waistMin: 67, waistMax: 71,  hipsMin: 92,  hipsMax: 96  },
      { size: "38", bustMin: 90,  bustMax: 94,  waistMin: 71, waistMax: 75,  hipsMin: 96,  hipsMax: 100 },
      { size: "40", bustMin: 94,  bustMax: 98,  waistMin: 75, waistMax: 79,  hipsMin: 100, hipsMax: 104 },
      { size: "42", bustMin: 98,  bustMax: 104, waistMin: 79, waistMax: 85,  hipsMin: 104, hipsMax: 110 },
      { size: "44", bustMin: 104, bustMax: 110, waistMin: 85, waistMax: 91,  hipsMin: 110, hipsMax: 116 },
      { size: "46", bustMin: 110, bustMax: 118, waistMin: 91, waistMax: 99,  hipsMin: 116, hipsMax: 124 },
    ],
    trouser: [
      { size: "32", waistMin: 59, waistMax: 63, hipsMin: 84,  hipsMax: 88  },
      { size: "34", waistMin: 63, waistMax: 67, hipsMin: 88,  hipsMax: 92  },
      { size: "36", waistMin: 67, waistMax: 71, hipsMin: 92,  hipsMax: 96  },
      { size: "38", waistMin: 71, waistMax: 75, hipsMin: 96,  hipsMax: 100 },
      { size: "40", waistMin: 75, waistMax: 79, hipsMin: 100, hipsMax: 104 },
      { size: "42", waistMin: 79, waistMax: 85, hipsMin: 104, hipsMax: 110 },
      { size: "44", waistMin: 85, waistMax: 91, hipsMin: 110, hipsMax: 116 },
      { size: "46", waistMin: 91, waistMax: 99, hipsMin: 116, hipsMax: 124 },
    ],
  },
  INT: {
    dress: [
      { size: "XS", bustMin: 78,  bustMax: 84,  waistMin: 60, waistMax: 66,  hipsMin: 84,  hipsMax: 90  },
      { size: "S",  bustMin: 84,  bustMax: 90,  waistMin: 66, waistMax: 72,  hipsMin: 90,  hipsMax: 96  },
      { size: "M",  bustMin: 90,  bustMax: 97,  waistMin: 72, waistMax: 79,  hipsMin: 96,  hipsMax: 103 },
      { size: "L",  bustMin: 97,  bustMax: 105, waistMin: 79, waistMax: 87,  hipsMin: 103, hipsMax: 112 },
      { size: "XL", bustMin: 105, bustMax: 115, waistMin: 87, waistMax: 97,  hipsMin: 112, hipsMax: 122 },
      { size: "2XL",bustMin: 115, bustMax: 127, waistMin: 97, waistMax: 109, hipsMin: 122, hipsMax: 134 },
    ],
    trouser: [
      { size: "XS", waistMin: 60, waistMax: 66, hipsMin: 84,  hipsMax: 90  },
      { size: "S",  waistMin: 66, waistMax: 72, hipsMin: 90,  hipsMax: 96  },
      { size: "M",  waistMin: 72, waistMax: 79, hipsMin: 96,  hipsMax: 103 },
      { size: "L",  waistMin: 79, waistMax: 87, hipsMin: 103, hipsMax: 112 },
      { size: "XL", waistMin: 87, waistMax: 97, hipsMin: 112, hipsMax: 122 },
    ],
  },
};

// Measurement columns to show based on category
const CATEGORY_COLUMNS: Record<string, Array<keyof SizeChartRow>> = {
  dress:    ["bustMin", "bustMax", "waistMin", "waistMax", "hipsMin", "hipsMax"],
  top:      ["bustMin", "bustMax", "waistMin", "waistMax", "shoulderMin", "shoulderMax"],
  jacket:   ["bustMin", "bustMax", "waistMin", "waistMax", "shoulderMin", "shoulderMax"],
  coat:     ["bustMin", "bustMax", "waistMin", "waistMax", "shoulderMin", "shoulderMax"],
  trouser:  ["waistMin", "waistMax", "hipsMin", "hipsMax", "inseamMin", "inseamMax"],
  skirt:    ["waistMin", "waistMax", "hipsMin", "hipsMax"],
  short:    ["waistMin", "waistMax", "hipsMin", "hipsMax"],
  jumpsuit: ["bustMin", "bustMax", "waistMin", "waistMax", "hipsMin", "hipsMax", "inseamMin", "inseamMax"],
  swimwear: ["bustMin", "bustMax", "waistMin", "waistMax", "hipsMin", "hipsMax"],
  knitwear: ["bustMin", "bustMax", "waistMin", "waistMax"],
};

const COLUMN_LABELS: Record<string, string> = {
  bustMin: "Bust min", bustMax: "Bust max",
  waistMin: "Waist min", waistMax: "Waist max",
  hipsMin: "Hips min", hipsMax: "Hips max",
  inseamMin: "Inseam min", inseamMax: "Inseam max",
  shoulderMin: "Shoulder min", shoulderMax: "Shoulder max",
  chestMin: "Chest min", chestMax: "Chest max",
};

// ─────────────────────────────────────────────
// Brand ID helper
// ─────────────────────────────────────────────

function getBrandId(): string | null {
  if (typeof window === "undefined") return null;
  // In production: read from JWT claim or profile endpoint
  // For now: stored in localStorage after brand onboarding
  return localStorage.getItem("loocbooc_brand_id");
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("loocbooc_token");
}

// ─────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────

async function fetchSizeCharts(brandId: string): Promise<SizeChart[]> {
  const token = getToken();
  const res = await fetch(`/api/v1/size-charts?brandId=${encodeURIComponent(brandId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load size charts (${res.status})`);
  const data = await res.json() as { charts: SizeChart[] };
  return data.charts;
}

async function createSizeChart(payload: {
  brandId: string;
  name: string;
  category: string;
  sizeSystem: SizeSystem;
  rows: SizeChartRow[];
}): Promise<SizeChart> {
  const token = getToken();
  const res = await fetch("/api/v1/size-charts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: "Unknown error" } })) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Request failed (${res.status})`);
  }
  const data = await res.json() as { chart: SizeChart };
  return data.chart;
}

async function deleteSizeChart(chartId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/v1/size-charts/${chartId}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete chart (${res.status})`);
  }
}

// ─────────────────────────────────────────────
// Row editor
// ─────────────────────────────────────────────

function RowEditor({
  rows,
  category,
  onChange,
}: {
  rows: SizeChartRow[];
  category: string;
  onChange: (rows: SizeChartRow[]) => void;
}) {
  const columns = CATEGORY_COLUMNS[category] ?? CATEGORY_COLUMNS["dress"]!;

  const addRow = () => {
    onChange([...rows, { size: "" }]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof SizeChartRow, value: string) => {
    const updated = [...rows];
    const row = { ...(updated[idx] ?? { size: "" }) };
    if (field === "size") {
      row.size = value;
    } else {
      const num = parseFloat(value);
      if (value === "" || value === "-") {
        delete row[field];
      } else if (!isNaN(num)) {
        (row as Record<string, number | string>)[field] = num;
      }
    }
    updated[idx] = row;
    onChange(updated);
  };

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#555", minWidth: 60 }}>
                Size
              </th>
              {columns.map((col) => (
                <th key={col} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#555", minWidth: 80, whiteSpace: "nowrap" }}>
                  {COLUMN_LABELS[col]} cm
                </th>
              ))}
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="text"
                    value={row.size}
                    onChange={(e) => updateRow(idx, "size", e.target.value)}
                    placeholder="e.g. 10"
                    style={{
                      width: 56,
                      padding: "6px 8px",
                      border: "1.5px solid #e5e5e5",
                      borderRadius: 6,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </td>
                {columns.map((col) => (
                  <td key={col} style={{ padding: "4px 8px", textAlign: "right" }}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0}
                      max={300}
                      value={(row as unknown as Record<string, number | string | undefined>)[col] ?? ""}
                      onChange={(e) => updateRow(idx, col, e.target.value)}
                      placeholder="—"
                      style={{
                        width: 68,
                        padding: "6px 8px",
                        border: "1.5px solid #e5e5e5",
                        borderRadius: 6,
                        fontSize: 13,
                        textAlign: "right",
                        outline: "none",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </td>
                ))}
                <td style={{ padding: "4px 4px" }}>
                  <button
                    onClick={() => removeRow(idx)}
                    title="Remove row"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#ccc",
                      fontSize: 16,
                      padding: "4px 6px",
                      borderRadius: 4,
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        style={{
          marginTop: 10,
          padding: "7px 14px",
          background: "#f8f8f8",
          border: "1.5px dashed #ddd",
          borderRadius: 8,
          fontSize: 13,
          color: "#666",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        + Add size row
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create chart form
// ─────────────────────────────────────────────

function CreateChartForm({
  onCreated,
  onCancel,
  brandId,
}: {
  onCreated: (chart: SizeChart) => void;
  onCancel: () => void;
  brandId: string;
}) {
  const [form, setForm] = useState<NewChartForm>({
    name: "",
    category: "dress",
    sizeSystem: "AU",
    rows: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<NewChartForm>) =>
    setForm((f) => ({ ...f, ...partial }));

  const loadTemplate = (system: SizeSystem, category: string) => {
    // Find the best matching template
    const systemTemplates = TEMPLATES[system];
    if (!systemTemplates) return;

    // Normalize category to match template keys
    const normalizedCat = category.replace(/s$/, ""); // "trousers" → "trouser"
    let templateRows = systemTemplates[normalizedCat];

    // Fall back to dress template if specific category not available
    if (!templateRows) {
      const isBottom = ["trouser", "pant", "skirt", "short"].includes(normalizedCat);
      const fallback = isBottom ? "trouser" : "dress";
      templateRows = systemTemplates[fallback];
    }

    if (templateRows) {
      setForm((f) => ({ ...f, rows: templateRows!.map((r) => ({ ...r })) }));
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Chart name is required."); return; }
    if (form.rows.length === 0) { setError("Add at least one size row."); return; }
    const incomplete = form.rows.find((r) => !r.size.trim());
    if (incomplete) { setError("All rows need a size label (e.g. 10, M, XS)."); return; }

    setSaving(true);
    setError(null);

    try {
      const chart = await createSizeChart({
        brandId,
        name: form.name.trim(),
        category: form.category,
        sizeSystem: form.sizeSystem,
        rows: form.rows,
      });
      onCreated(chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #e5e5e5",
      borderRadius: 16,
      padding: "24px",
      marginBottom: 24,
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>New size chart</h3>

      {/* Name */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
          Chart name <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Charcoal Women's Dress Sizing"
          maxLength={200}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1.5px solid #e5e5e5",
            borderRadius: 8,
            fontSize: 15,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; }}
        />
      </div>

      {/* Category + System */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
            Garment category
          </label>
          <select
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
              outline: "none",
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>
            Size system
          </label>
          <select
            value={form.sizeSystem}
            onChange={(e) => update({ sizeSystem: e.target.value as SizeSystem })}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
              outline: "none",
            }}
          >
            {SIZE_SYSTEMS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Template loader */}
      <div style={{
        marginBottom: 18,
        padding: "12px 16px",
        background: "#f8f8f8",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 18 }}>📐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Start from a template</div>
          <div style={{ fontSize: 12, color: "#666" }}>Pre-fill standard sizing for your selected category and size system.</div>
        </div>
        <button
          onClick={() => loadTemplate(form.sizeSystem, form.category)}
          style={{
            padding: "8px 14px",
            background: "#0a0a0a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Load template
        </button>
      </div>

      {/* Row editor */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>
            Size rows <span style={{ fontWeight: 400, color: "#888" }}>({form.rows.length} added)</span>
          </label>
          <span style={{ fontSize: 12, color: "#888" }}>All measurements in cm</span>
        </div>
        <RowEditor
          rows={form.rows}
          category={form.category}
          onChange={(rows) => update({ rows })}
        />
      </div>

      {/* Validation tip */}
      {form.rows.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: "10px 14px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          fontSize: 12,
          color: "#166534",
          display: "flex",
          gap: 8,
        }}>
          <span>✓</span>
          <div>
            <strong>{form.rows.filter(r => r.size.trim()).length} valid size{form.rows.filter(r => r.size.trim()).length !== 1 ? "s" : ""}</strong> defined.
            These will be used to generate fit recommendations for customers with avatars.
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 14,
          padding: "10px 14px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          fontSize: 13,
          color: "#dc2626",
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          style={{
            flex: 1,
            padding: "12px",
            background: saving ? "#555" : "#0a0a0a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save size chart"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "12px 20px",
            background: "#fff",
            color: "#555",
            border: "1.5px solid #e5e5e5",
            borderRadius: 10,
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Size chart card (read mode)
// ─────────────────────────────────────────────

function SizeChartCard({
  chart,
  onDelete,
}: {
  chart: SizeChart;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSizeChart(chart.id);
      onDelete(chart.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const columns = CATEGORY_COLUMNS[chart.category] ?? CATEGORY_COLUMNS["dress"]!;
  const categoryLabel = CATEGORIES.find((c) => c.value === chart.category)?.label ?? chart.category;

  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #e5e5e5",
      borderRadius: 14,
      marginBottom: 14,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{chart.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 10px",
              borderRadius: 20,
              background: "#f0f0f0",
              color: "#555",
            }}>
              {chart.sizeSystem}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 10px",
              borderRadius: 20,
              background: "#f0f0f0",
              color: "#555",
            }}>
              {categoryLabel}
            </span>
            <span style={{
              fontSize: 11,
              color: "#888",
              padding: "2px 0",
            }}>
              {chart.rows.length} size{chart.rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              padding: "6px 12px",
              background: "#f8f8f8",
              border: "1.5px solid #e5e5e5",
              borderRadius: 8,
              fontSize: 12,
              color: "#555",
              cursor: "pointer",
            }}
          >
            {expanded ? "Hide" : "View rows"}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: "6px 10px",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                color: "#ccc",
                cursor: "pointer",
              }}
              title="Delete chart"
              onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; }}
            >
              🗑
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#dc2626" }}>Delete?</span>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                style={{
                  padding: "4px 10px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {deleting ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: "4px 10px",
                  background: "transparent",
                  color: "#555",
                  border: "1.5px solid #e5e5e5",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded rows table */}
      {expanded && (
        <div style={{
          borderTop: "1px solid #f0f0f0",
          padding: "16px 20px",
          background: "#fafafa",
          overflowX: "auto",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #e5e5e5" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#333" }}>Size</th>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#666", whiteSpace: "nowrap" }}>
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700, fontSize: 14 }}>{row.size}</td>
                  {columns.map((col) => {
                    const val = (row as unknown as Record<string, number | string | undefined>)[col];
                    return (
                      <td key={col} style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: val != null ? "#333" : "#ccc" }}>
                        {val != null ? val : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 10, fontSize: 11, color: "#aaa" }}>
            All measurements in centimetres (cm). Created {new Date(chart.createdAt).toLocaleDateString("en-AU")}.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>📏</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No size charts yet</h3>
      <p style={{ fontSize: 14, color: "#666", maxWidth: 340, margin: "0 auto 28px", lineHeight: 1.6 }}>
        Add your brand&apos;s size charts so Loocbooc can recommend the right size to every customer automatically.
        Without size charts, the Fit Engine uses generic AU standard sizing.
      </p>
      <button
        onClick={onAdd}
        style={{
          padding: "13px 28px",
          background: "#0a0a0a",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Add first size chart
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// How it works callout
// ─────────────────────────────────────────────

function HowItWorks() {
  return (
    <div style={{
      background: "#f8f8f8",
      borderRadius: 14,
      padding: "20px 24px",
      marginBottom: 28,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>How size charts work</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[
          {
            icon: "👤",
            title: "Consumer creates avatar",
            text: "They enter body measurements once and their profile is stored.",
          },
          {
            icon: "📐",
            title: "Your chart is matched",
            text: "Their measurements are scored against your size chart per measurement.",
          },
          {
            icon: "🎯",
            title: "Best size selected",
            text: "The size with the highest weighted fit score is recommended.",
          },
          {
            icon: "💪",
            title: "Confidence grows",
            text: "More measurements = higher confidence. We show consumers how accurate the recommendation is.",
          },
        ].map(({ icon, title, text }) => (
          <div key={title} style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function SizeChartsPage() {
  const [charts, setCharts] = useState<SizeChart[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);

  // Resolve brand ID on mount
  useEffect(() => {
    const id = getBrandId();
    setBrandId(id);
    if (id) {
      loadCharts(id);
    } else {
      // Try resolving from /auth/me
      const token = getToken();
      if (!token) {
        setLoading(false);
        setError("You need to be signed in to manage size charts.");
        return;
      }
      fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      })
        .then((r) => r.json())
        .then((data: { data?: { brand?: { id?: string } } }) => {
          const resolvedId = data.data?.brand?.id ?? null;
          if (resolvedId) {
            setBrandId(resolvedId);
            localStorage.setItem("loocbooc_brand_id", resolvedId);
            loadCharts(resolvedId);
          } else {
            setLoading(false);
            setError("No brand found for this account. Complete brand onboarding first.");
          }
        })
        .catch(() => {
          setLoading(false);
          setError("Could not verify brand access.");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCharts = useCallback(async (bId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSizeCharts(bId);
      setCharts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load size charts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreated = (chart: SizeChart) => {
    setCharts((prev) => [chart, ...(prev ?? [])]);
    setShowCreateForm(false);
  };

  const handleDeleted = (id: string) => {
    setCharts((prev) => prev?.filter((c) => c.id !== id) ?? []);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: "32px 32px" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Size Charts</h1>
          <p style={{ fontSize: 14, color: "#666" }}>
            Manage your brand&apos;s size charts to power accurate fit recommendations for customers.
          </p>
        </div>
        {!showCreateForm && charts && charts.length > 0 && (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: "10px 20px",
              background: "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            + New chart
          </button>
        )}
      </div>

      {/* How it works */}
      <HowItWorks />

      {/* Create form */}
      {showCreateForm && brandId && (
        <CreateChartForm
          brandId={brandId}
          onCreated={handleCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px 18px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          color: "#dc2626",
          fontSize: 14,
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#888" }}>
          <div style={{ marginBottom: 12, fontSize: 24 }}>📐</div>
          Loading size charts...
        </div>
      )}

      {/* Chart list */}
      {!loading && !error && charts !== null && (
        <>
          {charts.length === 0 && !showCreateForm ? (
            <EmptyState onAdd={() => setShowCreateForm(true)} />
          ) : (
            <div>
              {charts.length > 0 && (
                <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
                  {charts.length} size chart{charts.length !== 1 ? "s" : ""} — these are used for fit recommendations on your campaigns.
                </p>
              )}
              {charts.map((chart) => (
                <SizeChartCard key={chart.id} chart={chart} onDelete={handleDeleted} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
