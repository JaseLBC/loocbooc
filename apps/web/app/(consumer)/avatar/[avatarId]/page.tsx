"use client";

/**
 * Avatar detail + edit page.
 *
 * Full measurement display with inline edit capability.
 * Shows body shape analysis, fit history, and taste profile.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AvatarFull {
  id: string;
  userId: string;
  nickname: string | null;
  isPrimary: boolean;
  measurementMethod: string | null;
  confidenceScore: number | null;
  confidenceLabel: "high" | "medium" | "low" | "uncalibrated";
  bodyShape: string | null;
  fitPreference: string | null;
  avatarImgUrl: string | null;
  sizeAu: string | null;
  sizeUs: string | null;
  sizeEu: string | null;
  completionPercent: number;
  hasFitHistory: boolean;
  createdAt: string;
  updatedAt: string;
  measurements: {
    height: number | null;
    weightKg: number | null;
    bust: number | null;
    chest: number | null;
    waist: number | null;
    hips: number | null;
    inseam: number | null;
    shoulderWidth: number | null;
    sleeveLength: number | null;
    neck: number | null;
    thigh: number | null;
    rise: number | null;
  };
  fitResults: {
    skuId: string;
    garmentName: string;
    brandName: string;
    recommendedSize: string | null;
    fitScore: number | null;
    fitLabel: "perfect" | "good" | "ok" | "poor" | null;
  }[];
}

interface EditState {
  [key: string]: string;
}

// ─────────────────────────────────────────────
// Measurement sections
// ─────────────────────────────────────────────

const MEASUREMENT_SECTIONS = [
  {
    title: "Basics",
    fields: [
      { key: "height",  label: "Height",  unit: "cm", hint: "Standing height without shoes" },
      { key: "weightKg", label: "Weight", unit: "kg" },
    ],
  },
  {
    title: "Upper body",
    fields: [
      { key: "bust",         label: "Bust",          unit: "cm", hint: "Around the fullest part of your chest" },
      { key: "chest",        label: "Chest",         unit: "cm" },
      { key: "shoulderWidth", label: "Shoulder width", unit: "cm" },
      { key: "sleeveLength", label: "Sleeve length", unit: "cm" },
      { key: "neck",         label: "Neck",          unit: "cm" },
    ],
  },
  {
    title: "Waist & lower",
    fields: [
      { key: "waist",   label: "Waist",   unit: "cm" },
      { key: "hips",    label: "Hips",    unit: "cm", hint: "Around the fullest part of your hips" },
      { key: "inseam",  label: "Inseam",  unit: "cm" },
      { key: "thigh",   label: "Thigh",   unit: "cm" },
      { key: "rise",    label: "Rise",    unit: "cm" },
    ],
  },
];

const BODY_SHAPE_ICONS: Record<string, string> = {
  hourglass: "⌛",
  pear: "🍐",
  apple: "🍎",
  rectangle: "▭",
  inverted_triangle: "▽",
};

const FIT_LABEL_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  perfect: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  good:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  ok:      { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  poor:    { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

// ─────────────────────────────────────────────
// Inline edit field
// ─────────────────────────────────────────────

function MeasurementField({
  label,
  unit,
  hint,
  value,
  editValue,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onChange,
}: {
  label: string;
  unit: string;
  hint?: string;
  value: number | null;
  editValue: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (val: string) => void;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #f5f5f5",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {hint && !isEditing && (
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{hint}</div>
        )}
        {isEditing && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input
              type="number"
              inputMode="decimal"
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancel();
              }}
              style={{
                width: 80,
                padding: "6px 10px",
                border: "2px solid #0a0a0a",
                borderRadius: 6,
                fontSize: 15,
                outline: "none",
              }}
            />
            <span style={{ fontSize: 13, color: "#888" }}>{unit}</span>
            <button onClick={onSave} style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
              Save
            </button>
            <button onClick={onCancel} style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
      {!isEditing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: value ? "#0a0a0a" : "#ccc" }}>
            {value !== null ? `${value} ${unit}` : "—"}
          </span>
          <button
            onClick={onEdit}
            style={{
              fontSize: 12,
              color: "#888",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AvatarDetailPage() {
  const params = useParams<{ avatarId: string }>();
  const router = useRouter();
  const [avatar, setAvatar] = useState<AvatarFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditState>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/avatars/${params.avatarId}`, { credentials: "include" });
        if (res.status === 401) {
          router.push("/auth/login?redirect=/avatar");
          return;
        }
        if (res.status === 404) {
          router.push("/avatar");
          return;
        }
        if (!res.ok) throw new Error("Failed to load avatar");
        const data = await res.json() as { avatar: AvatarFull };
        setAvatar(data.avatar);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.avatarId, router]);

  const startEdit = useCallback((key: string, currentValue: number | null) => {
    setEditingField(key);
    setEditValues((prev) => ({ ...prev, [key]: currentValue?.toString() ?? "" }));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const saveField = useCallback(async (key: string) => {
    if (!avatar) return;
    const rawValue = editValues[key];
    const numValue = rawValue ? parseFloat(rawValue) : null;

    setSavingField(key);
    try {
      const res = await fetch(`/api/v1/avatars/${avatar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: numValue }),
      });

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json() as { avatar: AvatarFull };

      // Refresh full avatar details
      const fullRes = await fetch(`/api/v1/avatars/${avatar.id}`, { credentials: "include" });
      if (fullRes.ok) {
        const fullData = await fullRes.json() as { avatar: AvatarFull };
        setAvatar(fullData.avatar);
      } else {
        setAvatar((prev) => prev ? {
          ...prev,
          measurements: { ...prev.measurements, [key]: numValue },
          completionPercent: data.avatar.completionPercent,
          bodyShape: data.avatar.bodyShape,
        } : null);
      }
      setEditingField(null);
    } catch {
      // Could show inline error — keeping simple
    } finally {
      setSavingField(null);
    }
  }, [avatar, editValues]);

  async function handleDelete() {
    if (!avatar) return;
    try {
      await fetch(`/api/v1/avatars/${avatar.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      router.push("/avatar");
    } catch {
      // handle
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888" }}>Loading...</div>
      </div>
    );
  }

  if (error || !avatar) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#dc2626" }}>{error ?? "Avatar not found"}</p>
        <Link href="/avatar">← Back to avatars</Link>
      </div>
    );
  }

  const meas = avatar.measurements;

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid #f0f0f0",
      }}>
        <button
          onClick={() => router.push("/avatar")}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: 0 }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {avatar.nickname ?? "My avatar"}
            {avatar.isPrimary && (
              <span style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 600,
                background: "#0a0a0a",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 12,
                letterSpacing: "0.05em",
              }}>
                PRIMARY
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {avatar.completionPercent}% complete
          </div>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: 520, margin: "0 auto" }}>
        {/* Body shape summary */}
        {avatar.bodyShape && (
          <div style={{
            background: "#f8f8f8",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 20,
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}>
            <span style={{ fontSize: 40 }}>
              {BODY_SHAPE_ICONS[avatar.bodyShape] ?? "◯"}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {avatar.bodyShape.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())} shape
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                {avatar.fitPreference && `${avatar.fitPreference.charAt(0).toUpperCase() + avatar.fitPreference.slice(1)} fit preference`}
                {avatar.sizeAu && ` · AU ${avatar.sizeAu}`}
              </div>
              <div style={{
                marginTop: 6,
                display: "inline-block",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 20,
                background: avatar.confidenceLabel === "high" ? "#f0fdf4" : avatar.confidenceLabel === "medium" ? "#eff6ff" : "#fffbeb",
                color: avatar.confidenceLabel === "high" ? "#16a34a" : avatar.confidenceLabel === "medium" ? "#2563eb" : "#d97706",
              }}>
                {avatar.confidenceLabel === "high" ? "High confidence" :
                 avatar.confidenceLabel === "medium" ? "Good confidence" :
                 avatar.confidenceLabel === "low" ? "Low confidence" :
                 "Add measurements to improve accuracy"}
              </div>
            </div>
          </div>
        )}

        {/* Measurement sections */}
        {MEASUREMENT_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>
              {section.title}
            </h3>
            {section.fields.map((field) => {
              const currentValue = meas[field.key as keyof typeof meas] as number | null;
              const isEditingThis = editingField === field.key;
              const isSaving = savingField === field.key;

              return (
                <MeasurementField
                  key={field.key}
                  label={field.label}
                  unit={field.unit}
                  hint={field.hint}
                  value={isSaving ? (parseFloat(editValues[field.key] ?? "") || null) : currentValue}
                  editValue={editValues[field.key] ?? ""}
                  isEditing={isEditingThis}
                  onEdit={() => startEdit(field.key, currentValue)}
                  onSave={() => void saveField(field.key)}
                  onCancel={cancelEdit}
                  onChange={(val) => setEditValues((prev) => ({ ...prev, [field.key]: val }))}
                />
              );
            })}
          </div>
        ))}

        {/* Fit history */}
        {avatar.fitResults.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Fit recommendations</h3>
            {avatar.fitResults.map((result, i) => {
              const style = result.fitLabel ? FIT_LABEL_STYLES[result.fitLabel] : null;
              return (
                <div key={`${result.skuId}-${i}`} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 0",
                  borderBottom: "1px solid #f5f5f5",
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{result.garmentName}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{result.brandName}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {result.recommendedSize && (
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        Size {result.recommendedSize}
                      </span>
                    )}
                    {result.fitLabel && style && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: style.bg,
                        color: style.color,
                        border: `1px solid ${style.border}`,
                      }}>
                        {result.fitLabel.charAt(0).toUpperCase() + result.fitLabel.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Danger zone */}
        <div style={{
          borderTop: "1px solid #f0f0f0",
          paddingTop: 20,
          marginTop: 8,
        }}>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                fontSize: 13,
                color: "#dc2626",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Delete this avatar
            </button>
          ) : (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "16px",
            }}>
              <p style={{ fontSize: 14, color: "#7f1d1d", marginBottom: 12 }}>
                This will permanently delete this avatar and all its fit history. Are you sure?
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "8px 16px",
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: "#555",
                    border: "1.5px solid #e5e5e5",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
