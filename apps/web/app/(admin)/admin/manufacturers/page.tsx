/**
 * Admin Manufacturers — /admin/manufacturers
 *
 * Manufacturer verification queue + full manufacturer list.
 *
 * The primary function of this page is giving admins the ability to:
 * - See all manufacturers awaiting verification (pending / under_review)
 * - Approve or reject each manufacturer, with a required reason on rejection
 * - View the full manufacturer list for auditing/oversight
 *
 * Two tabs:
 *   "Pending verification" — the action queue (default when count > 0)
 *   "All manufacturers"    — searchable full list
 *
 * API endpoints used:
 *   GET    /api/v1/admin/manufacturers/pending     → pending queue
 *   PATCH  /api/v1/admin/manufacturers/:id/approve → approve
 *   PATCH  /api/v1/admin/manufacturers/:id/reject  → reject (requires reason)
 *   GET    /api/v1/manufacturers?page=&limit=      → all manufacturers (public endpoint)
 *
 * Architecture: "use client" — needs action state + tab switching.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PendingManufacturer {
  id: string;
  displayName: string;
  country: string;
  city: string | null;
  specialisations: string[];
  certifications: string[];
  priceTier: string;
  verificationStatus: string;
  ownerEmail: string | null;
  ownerName: string | null;
  moqMin: number;
  createdAt: string;
  submittedAt: string | null;
}

interface ManufacturerSummary {
  id: string;
  displayName: string;
  country: string;
  city: string | null;
  specialisations: string[];
  priceTier: string;
  isVerified: boolean;
  moqMin: number;
  ratings: { overall: number; totalReviews: number };
}

interface AllManufacturersResult {
  data: ManufacturerSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

// ─────────────────────────────────────────────
// Country label map (ISO 3166-1 alpha-2 → name)
// ─────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  CN: "China", VN: "Vietnam", BD: "Bangladesh", IN: "India",
  TR: "Turkey", PT: "Portugal", IT: "Italy", PK: "Pakistan",
  AU: "Australia", US: "United States", GB: "United Kingdom",
  DE: "Germany", FR: "France", ES: "Spain",
};

function countryLabel(code: string): string {
  return COUNTRY_LABELS[code] ?? code;
}

// ─────────────────────────────────────────────
// Verification status badge
// ─────────────────────────────────────────────

function VerifStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending:       { label: "Pending",       cls: "bg-amber-50 text-amber-700 border-amber-200" },
    under_review:  { label: "Under review",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
    verified:      { label: "Verified",      cls: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20" },
    rejected:      { label: "Rejected",      cls: "bg-red-50 text-red-600 border-red-200" },
    unverified:    { label: "Unverified",    cls: "bg-[var(--surface-2)] text-[var(--text-tertiary)] border-[var(--surface-3)]" },
  };
  const found = config[status];
  const label = found?.label ?? status;
  const cls   = found?.cls   ?? "bg-[var(--surface-2)] text-[var(--text-tertiary)] border-[var(--surface-3)]";
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Price tier badge
// ─────────────────────────────────────────────

function PriceTierBadge({ tier }: { tier: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    mass:    { label: "Mass",    cls: "bg-[var(--surface-2)] text-[var(--text-secondary)]" },
    mid:     { label: "Mid",     cls: "bg-blue-50 text-blue-600" },
    premium: { label: "Premium", cls: "bg-purple-50 text-purple-600" },
    luxury:  { label: "Luxury",  cls: "bg-amber-50 text-amber-700" },
  };
  const found = config[tier];
  const label = found?.label ?? tier;
  const cls   = found?.cls   ?? "bg-[var(--surface-2)] text-[var(--text-secondary)]";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Rejection modal
// ─────────────────────────────────────────────

function RejectionModal({
  manufacturer,
  onConfirm,
  onCancel,
  loading,
}: {
  manufacturer: PendingManufacturer;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--loocbooc-white)] rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-1">
          Reject manufacturer
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          You are rejecting <strong>{manufacturer.displayName}</strong>. A reason is required —
          the manufacturer owner will receive an email with this reason.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. Insufficient information provided, certifications could not be verified, images do not match description…"
            className="w-full px-3 py-2.5 bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-black)] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Rejecting…" : "Confirm rejection"}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-[var(--surface-3)] text-sm font-medium text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pending manufacturer card
// ─────────────────────────────────────────────

function PendingCard({
  manufacturer,
  onApprove,
  onReject,
  actionLoading,
}: {
  manufacturer: PendingManufacturer;
  onApprove: (id: string) => void;
  onReject: (manufacturer: PendingManufacturer) => void;
  actionLoading: string | null;
}) {
  const isLoading = actionLoading === manufacturer.id;
  const submittedDaysAgo = manufacturer.submittedAt
    ? Math.floor((Date.now() - new Date(manufacturer.submittedAt).getTime()) / 86400000)
    : null;

  return (
    <div className="bg-[var(--loocbooc-white)] rounded-2xl border border-[var(--surface-3)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--surface-3)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="font-semibold text-[var(--text-primary)] text-lg truncate">
              {manufacturer.displayName}
            </h3>
            <VerifStatusBadge status={manufacturer.verificationStatus} />
            <PriceTierBadge tier={manufacturer.priceTier} />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {[manufacturer.city, countryLabel(manufacturer.country)].filter(Boolean).join(", ")}
          </p>
        </div>
        {submittedDaysAgo !== null && (
          <div className="shrink-0 text-right">
            <p className={`text-xs font-medium ${submittedDaysAgo > 7 ? "text-amber-600" : "text-[var(--text-tertiary)]"}`}>
              {submittedDaysAgo === 0 ? "Submitted today" : `Submitted ${submittedDaysAgo}d ago`}
            </p>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm border-b border-[var(--surface-3)]">
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Owner</p>
          <p className="font-medium text-[var(--text-primary)] truncate">
            {manufacturer.ownerName ?? "—"}
          </p>
          {manufacturer.ownerEmail && (
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {manufacturer.ownerEmail}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Min. order</p>
          <p className="font-medium text-[var(--text-primary)]">
            {manufacturer.moqMin === 0 ? "No minimum" : `${manufacturer.moqMin.toLocaleString()} units`}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Registered</p>
          <p className="font-medium text-[var(--text-primary)]">
            {new Date(manufacturer.createdAt).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Specialisations */}
      {manufacturer.specialisations.length > 0 && (
        <div className="px-6 py-3 border-b border-[var(--surface-3)] flex flex-wrap gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)] self-center mr-1">Specialisations:</span>
          {manufacturer.specialisations.map((s) => (
            <span
              key={s}
              className="px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text-secondary)] text-xs rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Certifications */}
      {manufacturer.certifications.length > 0 && (
        <div className="px-6 py-3 border-b border-[var(--surface-3)] flex flex-wrap gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)] self-center mr-1">Certifications:</span>
          {manufacturer.certifications.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] text-xs rounded-full font-medium"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
        <Link
          href={`/manufacturers/${manufacturer.id}`}
          target="_blank"
          className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
        >
          View full profile ↗
        </Link>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => onReject(manufacturer)}
            disabled={isLoading}
            className="px-5 py-2 text-sm font-medium border border-red-200 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => onApprove(manufacturer.id)}
            disabled={isLoading}
            className="px-5 py-2 text-sm font-semibold bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Approving…" : "✓ Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pending tab
// ─────────────────────────────────────────────

function PendingTab() {
  const [pending, setPending] = useState<PendingManufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingManufacturer | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/manufacturers/pending", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json() as { data: PendingManufacturer[] };
      setPending(data.data ?? []);
    } catch {
      showToast("error", "Failed to load pending manufacturers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/v1/admin/manufacturers/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Approval failed");
      showToast("success", "Manufacturer approved. They'll receive a confirmation email.");
      await fetchPending();
    } catch {
      showToast("error", "Failed to approve manufacturer. Try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      const res = await fetch(`/api/v1/admin/manufacturers/${rejectTarget.id}/reject`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Rejection failed");
      showToast("success", "Manufacturer rejected. They'll receive a rejection email.");
      setRejectTarget(null);
      await fetchPending();
    } catch {
      showToast("error", "Failed to reject manufacturer. Try again.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-[var(--surface-2)] rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">All clear</h2>
        <p className="text-[var(--text-secondary)] text-sm">
          No manufacturers are awaiting verification.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-40 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "success" ? "bg-[#22C55E] text-white" : "bg-red-500 text-white"}
        `}>
          {toast.type === "success" ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* Rejection modal */}
      {rejectTarget && (
        <RejectionModal
          manufacturer={rejectTarget}
          onConfirm={(reason) => void handleRejectConfirm(reason)}
          onCancel={() => setRejectTarget(null)}
          loading={actionLoading === rejectTarget.id}
        />
      )}

      <div className="space-y-4">
        {pending.map((m) => (
          <PendingCard
            key={m.id}
            manufacturer={m}
            onApprove={(id) => void handleApprove(id)}
            onReject={(mfr) => setRejectTarget(mfr)}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// All manufacturers tab
// ─────────────────────────────────────────────

function AllManufacturersTab() {
  const [result, setResult] = useState<AllManufacturersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      // Public search endpoint; search goes via displayName
      if (debouncedSearch) params.set("displayName", debouncedSearch);
      const res = await fetch(`/api/v1/manufacturers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json() as AllManufacturersResult;
      setResult(data);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const manufacturers = result?.data ?? [];
  const pagination = result?.pagination;

  return (
    <div>
      {/* Search */}
      <div className="mb-5 relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search manufacturers…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--surface-3)] rounded-lg bg-[var(--loocbooc-white)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-black)]"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--loocbooc-white)] rounded-2xl border border-[var(--surface-3)] overflow-hidden">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--surface-3)] bg-[var(--surface-2)]">
              {["Manufacturer", "Location", "MOQ", "Tier", "Rating", "Verified", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--surface-3)] animate-pulse">
                  {[200, 120, 80, 60, 80, 60, 80].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-[var(--surface-2)] rounded" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : manufacturers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No manufacturers found.
                </td>
              </tr>
            ) : (
              manufacturers.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-[var(--surface-3)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="max-w-[220px]">
                      <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                        {m.displayName}
                      </p>
                      {m.specialisations.slice(0, 2).join(", ") && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate">
                          {m.specialisations.slice(0, 2).join(", ")}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                    {[m.city, countryLabel(m.country)].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                    {m.moqMin === 0 ? "No min" : `${m.moqMin.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3">
                    <PriceTierBadge tier={m.priceTier} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                    {m.ratings.totalReviews > 0
                      ? `${m.ratings.overall.toFixed(1)} ★ (${m.ratings.totalReviews})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {m.isVerified ? (
                      <span className="text-[#22C55E] text-sm font-medium">✓ Verified</span>
                    ) : (
                      <span className="text-[var(--text-tertiary)] text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/manufacturers/${m.id}`}
                      target="_blank"
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline whitespace-nowrap"
                    >
                      View ↗
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdminManufacturersPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Fetch pending count for badge
  useEffect(() => {
    fetch("/api/v1/admin/manufacturers/pending", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d: { data?: unknown[] }) => setPendingCount(d.data?.length ?? 0))
      .catch(() => null);
  }, []);

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            Manufacturers
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Verify manufacturer accounts and oversee the full manufacturer directory.
          </p>
        </div>
        {pendingCount !== null && pendingCount > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-amber-600 text-lg">⚠</span>
            <span className="text-sm font-semibold text-amber-700">
              {pendingCount} awaiting verification
            </span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--surface-3)] mb-8">
        {([
          { id: "pending" as const, label: "Pending verification", icon: "🔍" },
          { id: "all" as const,     label: "All manufacturers",    icon: "🏭" },
        ] as const).map(({ id, label, icon }) => {
          const isCurrent = tab === id;
          const showBadge = id === "pending" && pendingCount !== null && pendingCount > 0;

          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`
                flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 -mb-px transition-colors
                ${isCurrent
                  ? "border-[var(--loocbooc-black)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--surface-3)]"
                }
              `}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {showBadge && (
                <span className={`
                  text-xs px-2 py-0.5 rounded-full font-semibold
                  ${isCurrent ? "bg-[var(--loocbooc-black)] text-white" : "bg-amber-100 text-amber-700"}
                `}>
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "pending" ? <PendingTab /> : <AllManufacturersTab />}
    </div>
  );
}
