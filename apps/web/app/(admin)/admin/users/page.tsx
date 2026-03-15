/**
 * Admin Users — /admin/users
 *
 * Platform user management. Search, filter by role, suspend/unsuspend.
 *
 * Gives admins visibility into every user account and the ability to
 * act on accounts that violate platform rules.
 *
 * Features:
 * - Searchable user table (email + name)
 * - Role filter tabs: All | Brands | Manufacturers | Consumers | Admins
 * - Suspend / unsuspend with confirmation
 * - User detail expandable row: brand name, last sign-in, join date
 *
 * API endpoints:
 *   GET   /api/v1/admin/users                 → list users (search, role, page, limit)
 *   PATCH /api/v1/admin/users/:id/suspend     → suspend/unsuspend a user
 *
 * Architecture: "use client" — filter interaction + action state.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  suspended: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  brandName: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserListResponse {
  data: AdminUser[];
  meta: PaginationMeta;
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

// ─────────────────────────────────────────────
// Role configuration
// ─────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; icon: string; badge: string }> = {
  brand_owner:     { label: "Brand owner",   icon: "🏷",  badge: "bg-purple-50 text-purple-700" },
  brand_member:    { label: "Brand member",  icon: "🏷",  badge: "bg-purple-50 text-purple-600" },
  manufacturer:    { label: "Manufacturer",  icon: "🏭",  badge: "bg-blue-50 text-blue-700" },
  consumer:        { label: "Consumer",      icon: "👤",  badge: "bg-[var(--surface-2)] text-[var(--text-secondary)]" },
  platform_admin:  { label: "Admin",         icon: "🛡",  badge: "bg-red-50 text-red-700" },
};

function getRoleCfg(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, icon: "❓", badge: "bg-[var(--surface-2)] text-[var(--text-tertiary)]" };
}

const ROLE_FILTER_TABS = [
  { value: "",                label: "All",           icon: "👥" },
  { value: "brand_owner",     label: "Brands",        icon: "🏷" },
  { value: "manufacturer",    label: "Manufacturers", icon: "🏭" },
  { value: "consumer",        label: "Consumers",     icon: "👤" },
  { value: "platform_admin",  label: "Admins",        icon: "🛡" },
];

// ─────────────────────────────────────────────
// Role badge
// ─────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg = getRoleCfg(role);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Suspend confirmation
// ─────────────────────────────────────────────

function SuspendConfirmModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: AdminUser;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const isSuspending = !user.suspended;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--loocbooc-white)] rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <p className={`text-3xl mb-3 ${isSuspending ? "text-red-500" : "text-[#22C55E]"}`}>
          {isSuspending ? "🚫" : "✅"}
        </p>
        <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-2">
          {isSuspending ? "Suspend this account?" : "Restore this account?"}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          {isSuspending
            ? `Suspending ${user.email} will prevent them from accessing the platform until reinstated.`
            : `Restoring ${user.email} will allow them to access the platform again.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`
              flex-1 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              ${isSuspending
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-[#22C55E] text-white hover:bg-[#16a34a]"
              }
            `}
          >
            {loading ? "Working…" : isSuspending ? "Suspend account" : "Restore account"}
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
// User row
// ─────────────────────────────────────────────

function UserRow({
  user,
  onSuspendToggle,
  actionLoading,
}: {
  user: AdminUser;
  onSuspendToggle: (user: AdminUser) => void;
  actionLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLoading = actionLoading === user.id;

  const initials = user.fullName
    ? user.fullName.split(" ").map((w) => w[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase()
    : (user.email[0] ?? "?").toUpperCase();

  return (
    <>
      <tr
        className={`
          border-t border-[var(--surface-3)] transition-colors cursor-pointer
          ${user.suspended ? "bg-red-50/50" : "hover:bg-[var(--surface-2)]"}
        `}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Avatar + name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
              ${user.suspended
                ? "bg-red-100 text-red-600"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)]"
              }
            `}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user.fullName ?? "—"}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] truncate">{user.email}</p>
            </div>
          </div>
        </td>

        {/* Role */}
        <td className="px-4 py-3">
          <RoleBadge role={user.role} />
        </td>

        {/* Brand */}
        <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
          {user.brandName ?? "—"}
        </td>

        {/* Joined */}
        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
          {new Date(user.createdAt).toLocaleDateString("en-AU", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </td>

        {/* Last sign-in */}
        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
          {user.lastSignInAt
            ? new Date(user.lastSignInAt).toLocaleDateString("en-AU", {
                day: "numeric", month: "short", year: "numeric",
              })
            : "Never"}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          {user.suspended ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
              🚫 Suspended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#22C55E]/10 text-[#22C55E]">
              ✓ Active
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onSuspendToggle(user)}
            disabled={isLoading}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${user.suspended
                ? "border-[#22C55E]/30 text-[#22C55E] bg-[#22C55E]/10 hover:bg-[#22C55E]/20"
                : "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
              }
            `}
          >
            {isLoading ? "…" : user.suspended ? "Restore" : "Suspend"}
          </button>
        </td>
      </tr>

      {/* Expanded details row */}
      {expanded && (
        <tr className="border-t-0 bg-[var(--surface-2)]">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">User ID</p>
                <p className="font-mono text-xs text-[var(--text-secondary)] break-all">{user.id}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Email</p>
                <p className="text-[var(--text-primary)] break-all">{user.email}</p>
              </div>
              {user.brandName && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Brand</p>
                  <p className="text-[var(--text-primary)]">{user.brandName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Account status</p>
                <p className={`font-medium ${user.suspended ? "text-red-600" : "text-[#22C55E]"}`}>
                  {user.suspended ? "Suspended" : "Active"}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/v1/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json() as UserListResponse;
      setUsers(data.data ?? []);
      setMeta(data.meta);
    } catch {
      // Non-fatal — will show empty state
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSuspendConfirm = async () => {
    if (!confirmTarget) return;
    setActionLoading(confirmTarget.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${confirmTarget.id}/suspend`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ suspended: !confirmTarget.suspended }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(
        "success",
        confirmTarget.suspended
          ? `${confirmTarget.email} has been restored.`
          : `${confirmTarget.email} has been suspended.`,
      );
      setConfirmTarget(null);
      await fetchUsers();
    } catch {
      showToast("error", "Failed to update account. Try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Summary counts from current page (approximate indicators)
  const suspendedInView = users.filter((u) => u.suspended).length;

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Toast */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-40 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "success" ? "bg-[#22C55E] text-white" : "bg-red-500 text-white"}
        `}>
          {toast.type === "success" ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* Suspend confirmation modal */}
      {confirmTarget && (
        <SuspendConfirmModal
          user={confirmTarget}
          onConfirm={() => void handleSuspendConfirm()}
          onCancel={() => setConfirmTarget(null)}
          loading={actionLoading === confirmTarget.id}
        />
      )}

      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            Users
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {meta
              ? `${meta.total.toLocaleString()} total users${suspendedInView > 0 ? ` · ${suspendedInView} suspended (this page)` : ""}`
              : "All registered accounts on the platform"
            }
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--surface-3)] rounded-lg bg-[var(--loocbooc-white)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-black)]"
          />
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 border-b border-[var(--surface-3)] mb-6 overflow-x-auto pb-0">
        {ROLE_FILTER_TABS.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setRoleFilter(value)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors -mb-px
              ${roleFilter === value
                ? "border-[var(--loocbooc-black)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--surface-3)]"
              }
            `}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--loocbooc-white)] rounded-2xl border border-[var(--surface-3)] overflow-hidden mb-6">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--surface-3)] bg-[var(--surface-2)]">
              {["User", "Role", "Brand", "Joined", "Last sign-in", "Status", ""].map((h) => (
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
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--surface-3)] animate-pulse">
                  {[220, 100, 100, 100, 100, 80, 80].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-[var(--surface-2)] rounded" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onSuspendToggle={(u) => setConfirmTarget(u)}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page} of {meta.totalPages} · {meta.total.toLocaleString()} users
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
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
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
