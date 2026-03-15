/**
 * Admin Campaigns — /admin/campaigns
 *
 * Full list of all campaigns on the platform.
 * Search, filter by status, flag/unflag, force-expire.
 *
 * Gives admins visibility into every campaign in the system
 * and the ability to act on problematic ones.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AdminCampaign {
  id: string;
  title: string;
  status: string;
  brandName: string;
  brandId: string;
  currentBackingCount: number;
  moq: number;
  moqReached: boolean;
  backerPriceCents: number;
  currency: string;
  campaignStart: string;
  campaignEnd: string;
  createdAt: string;
  flagged: boolean;
  flagReason: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

const STATUS_STYLES: Record<string, string> = {
  draft:          "bg-slate-100 text-slate-600",
  scheduled:      "bg-blue-50 text-blue-600",
  active:         "bg-[#22C55E]/10 text-[#22C55E]",
  moq_reached:    "bg-indigo-50 text-indigo-600",
  funded:         "bg-indigo-100 text-indigo-700",
  in_production:  "bg-purple-50 text-purple-700",
  shipped:        "bg-sky-50 text-sky-700",
  completed:      "bg-emerald-50 text-emerald-700",
  cancelled:      "bg-red-50 text-red-600",
  expired:        "bg-orange-50 text-orange-600",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", scheduled: "Scheduled", active: "Live",
  moq_reached: "Goal Reached", funded: "Funded",
  in_production: "In Production", shipped: "Shipped",
  completed: "Completed", cancelled: "Cancelled", expired: "Expired",
};

const ALL_STATUSES = [
  "draft", "scheduled", "active", "moq_reached", "funded",
  "in_production", "shipped", "completed", "cancelled", "expired",
];

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────

function CampaignRow({
  campaign,
  onRefresh,
}: {
  campaign: AdminCampaign;
  onRefresh: () => void;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmExpire, setConfirmExpire] = useState(false);

  const doFlag = async (flagged: boolean) => {
    setActionLoading(true);
    const reason = flagged ? window.prompt("Reason for flagging this campaign:") : null;
    if (flagged && !reason) { setActionLoading(false); return; }
    try {
      await fetch(`/api/v1/admin/campaigns/${campaign.id}/flag`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ flagged, reason }),
      });
      onRefresh();
    } catch {
      alert("Failed to update campaign flag.");
    } finally {
      setActionLoading(false);
    }
  };

  const doForceExpire = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/v1/admin/campaigns/${campaign.id}/force-expire`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      onRefresh();
    } catch {
      alert("Failed to expire campaign.");
    } finally {
      setActionLoading(false);
      setConfirmExpire(false);
    }
  };

  const pct = Math.min(100, Math.round((campaign.currentBackingCount / campaign.moq) * 100));
  const endDate = new Date(campaign.campaignEnd);
  const isOverdue = endDate < new Date() && campaign.status === "active";

  return (
    <tr className={`border-t border-[var(--surface-3)] hover:bg-[var(--surface-2)] transition-colors ${
      campaign.flagged ? "bg-red-50" : ""
    }`}>
      {/* Campaign */}
      <td className="px-4 py-3">
        <div className="max-w-[260px]">
          <p className="font-medium text-sm text-[var(--text-primary)] truncate" title={campaign.title}>
            {campaign.flagged && <span className="text-red-500 mr-1">⚑</span>}
            {campaign.title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] truncate">{campaign.brandName}</p>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <StatusBadge status={campaign.status} />
          {isOverdue && (
            <span className="text-[10px] text-red-500 font-medium">OVERDUE</span>
          )}
        </div>
      </td>

      {/* Progress */}
      <td className="px-4 py-3">
        <div className="w-28">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
            <span>{campaign.currentBackingCount}</span>
            <span className="text-[var(--text-tertiary)]">/ {campaign.moq}</span>
          </div>
          <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: pct >= 100 ? "#22C55E" : "#6366f1",
              }}
            />
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
        {campaign.currency} {(campaign.backerPriceCents / 100).toFixed(2)}
      </td>

      {/* Dates */}
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
        <div>
          <p>{new Date(campaign.campaignStart).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</p>
          <p className={isOverdue ? "text-red-500 font-medium" : ""}>
            → {new Date(campaign.campaignEnd).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </p>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/back/${campaign.id}`}
            target="_blank"
            className="px-2.5 py-1.5 text-xs border border-[var(--surface-3)] rounded text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            View ↗
          </Link>

          {campaign.flagged ? (
            <button
              onClick={() => void doFlag(false)}
              disabled={actionLoading}
              className="px-2.5 py-1.5 text-xs bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Unflag
            </button>
          ) : (
            <button
              onClick={() => void doFlag(true)}
              disabled={actionLoading}
              className="px-2.5 py-1.5 text-xs border border-[var(--surface-3)] text-[var(--text-secondary)] rounded hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
            >
              Flag
            </button>
          )}

          {["draft", "active", "scheduled"].includes(campaign.status) && (
            <>
              {confirmExpire ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => void doForceExpire()}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmExpire(false)}
                    className="px-2.5 py-1.5 text-xs border border-[var(--surface-3)] rounded text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmExpire(true)}
                  className="px-2.5 py-1.5 text-xs border border-orange-200 text-orange-600 bg-orange-50 rounded hover:bg-orange-100 transition-colors"
                >
                  Expire
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (flaggedOnly) params.set("flaggedOnly", "true");

      const res = await fetch(`/api/v1/admin/campaigns?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { data: AdminCampaign[]; meta: PaginationMeta };
      setCampaigns(data.data ?? []);
      setMeta(data.meta);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, flaggedOnly, page]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, flaggedOnly]);

  return (
    <div className="p-8 max-w-screen-2xl">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            Campaigns
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {meta ? `${meta.total.toLocaleString()} total` : "All campaigns on the platform"}
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns or brands…"
            className="w-full pl-8 pr-4 py-2 text-sm border border-[var(--surface-3)] rounded-md bg-[var(--surface-1)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-black)]"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-[var(--surface-3)] rounded-md bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-black)]"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>

        {/* Flagged toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="accent-[var(--loocbooc-black)]"
          />
          <span className="text-sm text-[var(--text-primary)]">Flagged only</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--surface-3)] overflow-hidden">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--surface-3)] bg-[var(--surface-2)]">
              {["Campaign", "Status", "Progress", "Price", "Dates", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--surface-3)] animate-pulse">
                  {[200, 80, 120, 80, 100, 120].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-[var(--surface-2)] rounded" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-tertiary)] text-sm">
                  No campaigns found.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} onRefresh={() => void fetchCampaigns()} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page} of {meta.totalPages} · {meta.total} campaigns
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-md hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="px-4 py-2 text-sm border border-[var(--surface-3)] rounded-md hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
