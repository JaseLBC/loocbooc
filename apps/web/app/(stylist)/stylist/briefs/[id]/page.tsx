"use client";

/**
 * Stylist brief detail + lookbook workspace.
 *
 * The most complex page in the stylist portal.
 * Allows a stylist to:
 *   1. View brief details (consumer occasion, budget, style notes, avatar size hint)
 *   2. Mark work started
 *   3. Build a lookbook: add/remove/reorder items
 *   4. Publish lookbook to client
 *
 * Lookbook item add form:
 *   - Product name, brand, price, image URL, external URL, stylist note
 *   - Optional: campaign ID (links directly to Back It campaign)
 *
 * States driven by brief status:
 *   assigned    → CTA to start work
 *   in_progress → lookbook editor active
 *   delivered   → lookbook published, waiting for consumer
 *   accepted    → read-only, show purchased items
 *
 * API:
 *   GET  /api/v1/briefs/:id                            — load brief + lookbook
 *   POST /api/v1/briefs/:id/start-work                 — mark in_progress
 *   PATCH /api/v1/briefs/:briefId/lookbook             — update lookbook title/notes
 *   POST /api/v1/briefs/:briefId/lookbook/publish      — publish to consumer
 *   POST /api/v1/briefs/:briefId/lookbook/items        — add item
 *   PATCH /api/v1/briefs/:briefId/lookbook/items/:id   — update item
 *   DELETE /api/v1/briefs/:briefId/lookbook/items/:id  — remove item
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BriefStatus = "open" | "assigned" | "in_progress" | "delivered" | "accepted" | "closed";
type LookbookStatus = "draft" | "published" | "accepted" | "closed";

interface LookbookItem {
  id: string;
  productName: string;
  brandName: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  externalUrl: string | null;
  campaignId: string | null;
  skuId: string | null;
  stylistNote: string | null;
  sortOrder: number;
  purchasedAt: string | null;
}

interface Lookbook {
  id: string;
  briefId: string;
  stylistId: string;
  title: string | null;
  notes: string | null;
  status: LookbookStatus;
  publishedAt: string | null;
  acceptedAt: string | null;
  items: LookbookItem[];
  totalItems: number;
  totalValueCents: number;
  purchasedCount: number;
}

interface BriefDetail {
  id: string;
  title: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  occasion: string[];
  styleNotes: string | null;
  brandPreferences: string[];
  excludedBrands: string[];
  status: BriefStatus;
  sizeInfo: Record<string, unknown> | null;
  hasLookbook: boolean;
  createdAt: string;
  updatedAt: string;
  lookbook?: Lookbook | null;
}

interface AddItemDraft {
  productName: string;
  brandName: string;
  priceCents: string;
  imageUrl: string;
  externalUrl: string;
  campaignId: string;
  stylistNote: string;
}

const EMPTY_DRAFT: AddItemDraft = {
  productName: "",
  brandName: "",
  priceCents: "",
  imageUrl: "",
  externalUrl: "",
  campaignId: "",
  stylistNote: "",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCents(cents: number | null | undefined, currency = "AUD"): string {
  if (!cents) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function parsePriceToCents(val: string): number | null {
  const num = parseFloat(val.replace(/[^0-9.]/g, ""));
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100);
}

// ─────────────────────────────────────────────
// Lookbook item card (editable)
// ─────────────────────────────────────────────

function LookbookItemCard({
  item,
  currency,
  editable,
  onDelete,
  onEdit,
}: {
  item: LookbookItem;
  currency: string;
  editable: boolean;
  onDelete: (id: string) => void;
  onEdit: (item: LookbookItem) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Remove "${item.productName}" from the lookbook?`)) return;
    setDeleting(true);
    onDelete(item.id);
  }

  return (
    <div style={{
      border: `1.5px solid ${item.purchasedAt ? "#bbf7d0" : "#e5e5e5"}`,
      borderRadius: 14,
      overflow: "hidden",
      background: "#fff",
      position: "relative",
    }}>
      {/* Image */}
      <div style={{
        width: "100%",
        paddingBottom: "100%",
        background: item.imageUrl ? "transparent" : "#f8f8f8",
        position: "relative",
        overflow: "hidden",
      }}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.productName}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#ccc" }}>
            👗
          </div>
        )}
        {item.purchasedAt && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "#16a34a", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
            PURCHASED
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 1 }}>{item.productName}</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{item.brandName}</div>
        {item.priceCents && (
          <div style={{ fontWeight: 700, fontSize: 14 }}>{formatCents(item.priceCents, currency)}</div>
        )}
        {item.stylistNote && (
          <div style={{ fontSize: 11, color: "#555", marginTop: 6, fontStyle: "italic", lineHeight: 1.4 }}>
            "{item.stylistNote}"
          </div>
        )}

        {/* Edit/delete (only when editable) */}
        {editable && (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={() => onEdit(item)}
              style={{ flex: 1, padding: "7px 0", background: "#f4f4f5", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#333" }}
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ flex: 1, padding: "7px 0", background: "#fef2f2", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#dc2626" }}
            >
              {deleting ? "…" : "Remove"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Add/edit item form
// ─────────────────────────────────────────────

function ItemForm({
  initial,
  briefCurrency,
  onSave,
  onCancel,
}: {
  initial: AddItemDraft;
  briefCurrency: string;
  onSave: (draft: AddItemDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof AddItemDraft, val: string) {
    setDraft((prev) => ({ ...prev, [field]: val }));
  }

  async function handleSave() {
    if (!draft.productName.trim()) { setError("Product name is required."); return; }
    if (!draft.brandName.trim()) { setError("Brand name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1.5px solid #e5e5e5",
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div style={{ padding: "20px", borderTop: "2px solid #0a0a0a" }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
        {initial.productName ? "Edit item" : "Add item"}
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Product name *</label>
          <input
            value={draft.productName}
            onChange={(e) => set("productName", e.target.value)}
            placeholder="e.g. Silk Slip Dress"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Brand *</label>
          <input
            value={draft.brandName}
            onChange={(e) => set("brandName", e.target.value)}
            placeholder="e.g. Charcoal Clothing"
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Price ({briefCurrency})</label>
          <input
            value={draft.priceCents}
            onChange={(e) => set("priceCents", e.target.value)}
            placeholder="e.g. 120"
            type="number"
            min="0"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Campaign ID (Back It)</label>
          <input
            value={draft.campaignId}
            onChange={(e) => set("campaignId", e.target.value)}
            placeholder="Optional campaign UUID"
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Image URL</label>
        <input
          value={draft.imageUrl}
          onChange={(e) => set("imageUrl", e.target.value)}
          placeholder="https://..."
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Product link</label>
        <input
          value={draft.externalUrl}
          onChange={(e) => set("externalUrl", e.target.value)}
          placeholder="https://..."
          style={fieldStyle}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Your note to the client</label>
        <textarea
          value={draft.stylistNote}
          onChange={(e) => set("stylistNote", e.target.value)}
          placeholder="Why you picked this piece…"
          rows={3}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: "12px", background: "transparent", border: "1.5px solid #e5e5e5", borderRadius: 10, fontSize: 14, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 2, padding: "12px", background: saving ? "#888" : "#0a0a0a", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving…" : (initial.productName ? "Save changes" : "Add to lookbook")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Publish confirmation
// ─────────────────────────────────────────────

function PublishModal({
  itemCount,
  totalValue,
  currency,
  onPublish,
  onCancel,
}: {
  itemCount: number;
  totalValue: number;
  currency: string;
  onPublish: () => Promise<void>;
  onCancel: () => void;
}) {
  const [publishing, setPublishing] = useState(false);

  async function handle() {
    setPublishing(true);
    try { await onPublish(); }
    finally { setPublishing(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "32px 24px 40px", width: "100%", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>🚀</div>
        <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Publish lookbook</h2>
        <p style={{ textAlign: "center", color: "#666", fontSize: 14, marginBottom: 8 }}>
          {itemCount} item{itemCount !== 1 ? "s" : ""} · {totalValue > 0 ? formatCents(totalValue, currency) : "No priced items"}
        </p>
        <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginBottom: 24 }}>
          Once published, your client will be notified. You can&apos;t edit the lookbook after publishing.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "14px", background: "transparent", border: "1.5px solid #e5e5e5", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={publishing}
            style={{ flex: 2, padding: "14px", background: publishing ? "#888" : "#0a0a0a", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: publishing ? "not-allowed" : "pointer" }}
          >
            {publishing ? "Publishing…" : "Publish to client"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function StylistBriefDetailPage() {
  const params = useParams();
  const briefId = params.id as string;

  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingWork, setStartingWork] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LookbookItem | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [lookbookTitle, setLookbookTitle] = useState("");
  const [lookbookNotes, setLookbookNotes] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadBrief = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/briefs/${briefId}`, { credentials: "include" });
      if (res.status === 401) { window.location.href = "/auth/login"; return; }
      if (res.status === 404) { setError("Brief not found."); return; }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as { brief: BriefDetail };
      setBrief(data.brief);
      if (data.brief.lookbook) {
        setLookbookTitle(data.brief.lookbook.title ?? "");
        setLookbookNotes(data.brief.lookbook.notes ?? "");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [briefId]);

  useEffect(() => { loadBrief(); }, [loadBrief]);

  async function handleStartWork() {
    setStartingWork(true);
    try {
      const res = await fetch(`/api/v1/briefs/${briefId}/start-work`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Work started! Build your lookbook below.");
        await loadBrief();
      }
    } finally {
      setStartingWork(false);
    }
  }

  async function handleSaveLookbookMeta() {
    if (!brief?.lookbook) return;
    setSavingMeta(true);
    try {
      await fetch(`/api/v1/briefs/${briefId}/lookbook`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: lookbookTitle || null,
          notes: lookbookNotes || null,
        }),
      });
      showToast("Saved.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddItem(draft: AddItemDraft) {
    const body = {
      productName: draft.productName,
      brandName: draft.brandName,
      priceCents: parsePriceToCents(draft.priceCents),
      currency: brief?.currency ?? "AUD",
      imageUrl: draft.imageUrl || null,
      externalUrl: draft.externalUrl || null,
      campaignId: draft.campaignId || null,
      stylistNote: draft.stylistNote || null,
    };

    const res = await fetch(`/api/v1/briefs/${briefId}/lookbook/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(err.error?.message ?? "Failed to add item.");
    }

    showToast("Item added!");
    setShowItemForm(false);
    await loadBrief();
  }

  async function handleEditItem(draft: AddItemDraft) {
    if (!editingItem) return;
    const body = {
      productName: draft.productName,
      brandName: draft.brandName,
      priceCents: parsePriceToCents(draft.priceCents),
      imageUrl: draft.imageUrl || null,
      externalUrl: draft.externalUrl || null,
      campaignId: draft.campaignId || null,
      stylistNote: draft.stylistNote || null,
    };

    const res = await fetch(`/api/v1/briefs/${briefId}/lookbook/items/${editingItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(err.error?.message ?? "Failed to save.");
    }

    showToast("Updated.");
    setEditingItem(null);
    await loadBrief();
  }

  async function handleDeleteItem(itemId: string) {
    const res = await fetch(`/api/v1/briefs/${briefId}/lookbook/items/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setBrief((prev) => {
        if (!prev?.lookbook) return prev;
        return {
          ...prev,
          lookbook: {
            ...prev.lookbook,
            items: prev.lookbook.items.filter((i) => i.id !== itemId),
          },
        };
      });
    }
  }

  async function handlePublish() {
    const res = await fetch(`/api/v1/briefs/${briefId}/lookbook/publish`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to publish.");
    showToast("🎉 Lookbook published! Your client has been notified.");
    setShowPublishModal(false);
    await loadBrief();
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ color: "#888" }}>Loading…</div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#dc2626" }}>{error}</p>
        <Link href="/stylist/briefs" style={{ color: "#555", textDecoration: "underline", fontSize: 14 }}>← Back</Link>
      </div>
    );
  }

  const lookbook = brief.lookbook;
  const isEditable = brief.status === "in_progress" && (!lookbook || lookbook.status === "draft");
  const isPublished = lookbook?.status === "published";
  const isAccepted = lookbook?.status === "accepted";
  const canStartWork = brief.status === "assigned";
  const canPublish = isEditable && (lookbook?.items?.length ?? 0) >= 1;

  const editingDraft: AddItemDraft = editingItem
    ? {
        productName: editingItem.productName,
        brandName: editingItem.brandName,
        priceCents: editingItem.priceCents ? String(editingItem.priceCents / 100) : "",
        imageUrl: editingItem.imageUrl ?? "",
        externalUrl: editingItem.externalUrl ?? "",
        campaignId: editingItem.campaignId ?? "",
        stylistNote: editingItem.stylistNote ?? "",
      }
    : EMPTY_DRAFT;

  return (
    <div style={{ minHeight: "100dvh", background: "#fafafa" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.type === "success" ? "#0a0a0a" : "#dc2626",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 200,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e5e5e5",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}>
        <Link href="/stylist/briefs" style={{ textDecoration: "none", color: "#555", fontSize: 20, lineHeight: 1 }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {brief.title ?? brief.occasion.join(", ") ?? "Style brief"}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: brief.status === "in_progress" ? "#1d4ed8" : brief.status === "delivered" ? "#065f46" : brief.status === "accepted" ? "#374151" : "#92400e",
              background: brief.status === "in_progress" ? "#eff6ff" : brief.status === "delivered" ? "#f0fdf4" : "#f9fafb",
              border: "1px solid #e5e5e5",
              padding: "2px 8px",
              borderRadius: 20,
            }}>
              {brief.status.replace("_", " ").toUpperCase()}
            </span>
            {lookbook && (
              <span style={{ fontSize: 11, color: "#888" }}>
                {lookbook.items.length} item{lookbook.items.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Publish CTA */}
        {canPublish && !showItemForm && !editingItem && (
          <button
            onClick={() => setShowPublishModal(true)}
            style={{
              padding: "9px 18px",
              background: "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Publish 🚀
          </button>
        )}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 80px" }}>

        {/* Brief summary */}
        <div style={{ background: "#fff", margin: "16px 20px", borderRadius: 14, border: "1.5px solid #e5e5e5", padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#0a0a0a" }}>Client brief</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Budget</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {brief.budgetMinCents && brief.budgetMaxCents
                  ? `${formatCents(brief.budgetMinCents)} – ${formatCents(brief.budgetMaxCents)}`
                  : brief.budgetMinCents ? `${formatCents(brief.budgetMinCents)}+` : "Open"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Size</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {brief.sizeInfo ? JSON.stringify(brief.sizeInfo).slice(0, 30) : "Not specified"}
              </div>
            </div>
          </div>

          {brief.occasion.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Occasion</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {brief.occasion.map((occ) => (
                  <span key={occ} style={{ padding: "4px 12px", background: "#f4f4f5", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{occ}</span>
                ))}
              </div>
            </div>
          )}

          {brief.styleNotes && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Style notes</div>
              <p style={{ fontSize: 13, color: "#444", margin: 0, lineHeight: 1.6 }}>{brief.styleNotes}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {brief.brandPreferences.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Preferred brands</div>
                <div style={{ fontSize: 12, color: "#333" }}>{brief.brandPreferences.join(", ")}</div>
              </div>
            )}
            {brief.excludedBrands.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Exclude</div>
                <div style={{ fontSize: 12, color: "#dc2626" }}>{brief.excludedBrands.join(", ")}</div>
              </div>
            )}
          </div>
        </div>

        {/* Start work CTA */}
        {canStartWork && (
          <div style={{ padding: "0 20px", marginBottom: 16 }}>
            <div style={{
              padding: "24px",
              background: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: 14,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎨</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Ready to start?</div>
              <p style={{ fontSize: 14, color: "#555", marginBottom: 20 }}>
                Mark this brief as in-progress to begin building the lookbook. Your client will see you've started.
              </p>
              <button
                onClick={handleStartWork}
                disabled={startingWork}
                style={{
                  padding: "13px 32px",
                  background: startingWork ? "#888" : "#0a0a0a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: startingWork ? "not-allowed" : "pointer",
                }}
              >
                {startingWork ? "Starting…" : "Start work on this brief"}
              </button>
            </div>
          </div>
        )}

        {/* Lookbook workspace */}
        {(brief.status === "in_progress" || brief.status === "delivered" || brief.status === "accepted") && (
          <div style={{ padding: "0 20px" }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e5e5", overflow: "hidden", marginBottom: 16 }}>
              {/* Lookbook header */}
              <div style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
                  {isPublished ? "Published lookbook" : isAccepted ? "Accepted lookbook" : "Lookbook workspace"}
                </div>

                {/* Lookbook title + notes (editable when in_progress) */}
                {isEditable ? (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Lookbook title</label>
                      <input
                        value={lookbookTitle}
                        onChange={(e) => setLookbookTitle(e.target.value)}
                        placeholder="e.g. Winter office edit"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Note to client</label>
                      <textarea
                        value={lookbookNotes}
                        onChange={(e) => setLookbookNotes(e.target.value)}
                        placeholder="Introduce your curation — why you picked these pieces…"
                        rows={3}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>
                    <button
                      onClick={handleSaveLookbookMeta}
                      disabled={savingMeta}
                      style={{ padding: "8px 16px", background: savingMeta ? "#888" : "#f4f4f5", color: "#333", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {savingMeta ? "Saving…" : "Save details"}
                    </button>
                  </>
                ) : (
                  <>
                    {lookbook?.title && <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{lookbook.title}</div>}
                    {lookbook?.notes && <p style={{ fontSize: 14, color: "#555", fontStyle: "italic", margin: "0 0 8px" }}>"{lookbook.notes}"</p>}
                  </>
                )}
              </div>

              {/* Items grid */}
              {lookbook && lookbook.items.length > 0 && (
                <div style={{ padding: "0 16px 16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                    {lookbook.items
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item) => (
                        <LookbookItemCard
                          key={item.id}
                          item={item}
                          currency={brief.currency}
                          editable={isEditable}
                          onDelete={handleDeleteItem}
                          onEdit={(item) => {
                            setEditingItem(item);
                            setShowItemForm(false);
                          }}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Empty lookbook state */}
              {(!lookbook || lookbook.items.length === 0) && isEditable && (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>👗</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>No items yet</div>
                  <p style={{ fontSize: 13, color: "#888" }}>Add products below to build the lookbook.</p>
                </div>
              )}

              {/* Add item CTA */}
              {isEditable && !showItemForm && !editingItem && (
                <div style={{ padding: "0 16px 16px" }}>
                  <button
                    onClick={() => { setShowItemForm(true); setEditingItem(null); }}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "transparent",
                      border: "2px dashed #e5e5e5",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#555",
                      cursor: "pointer",
                    }}
                  >
                    + Add item
                  </button>
                </div>
              )}

              {/* Add item form */}
              {showItemForm && isEditable && (
                <ItemForm
                  initial={EMPTY_DRAFT}
                  briefCurrency={brief.currency}
                  onSave={handleAddItem}
                  onCancel={() => setShowItemForm(false)}
                />
              )}

              {/* Edit item form */}
              {editingItem && isEditable && (
                <ItemForm
                  initial={editingDraft}
                  briefCurrency={brief.currency}
                  onSave={handleEditItem}
                  onCancel={() => setEditingItem(null)}
                />
              )}
            </div>

            {/* Published state info */}
            {isPublished && (
              <div style={{
                padding: "14px 16px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 12,
                fontSize: 14,
                color: "#065f46",
                marginBottom: 16,
              }}>
                🚀 Lookbook published and visible to client. Waiting for acceptance.
              </div>
            )}

            {/* Accepted state */}
            {isAccepted && (
              <div style={{
                padding: "14px 16px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                fontSize: 14,
                color: "#1d4ed8",
                marginBottom: 16,
              }}>
                ✅ Client accepted this lookbook on {lookbook?.acceptedAt ? new Date(lookbook.acceptedAt).toLocaleDateString("en-AU") : "—"}.
                {lookbook && lookbook.purchasedCount > 0 && ` ${lookbook.purchasedCount} item${lookbook.purchasedCount > 1 ? "s" : ""} purchased.`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Publish modal */}
      {showPublishModal && lookbook && (
        <PublishModal
          itemCount={lookbook.items.length}
          totalValue={lookbook.totalValueCents}
          currency={brief.currency}
          onPublish={handlePublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
    </div>
  );
}
