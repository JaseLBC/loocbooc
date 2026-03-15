/**
 * Admin portal layout — wraps all admin pages.
 *
 * Requires PLATFORM_ADMIN role. Anyone else gets a locked-out state.
 * Sidebar: platform overview, campaigns, manufacturers, users.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

function useAdminAuth() {
  const [status, setStatus] = useState<"loading" | "ok" | "unauthorized">("loading");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("loocbooc_token") : null;
    if (!token) {
      setStatus("unauthorized");
      return;
    }

    fetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { role?: string }) => {
        setStatus(data.role === "platform_admin" ? "ok" : "unauthorized");
      })
      .catch(() => setStatus("unauthorized"));
  }, []);

  return status;
}

// ─────────────────────────────────────────────
// Nav item
// ─────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon,
  current,
  badge,
}: {
  href: string;
  label: string;
  icon: string;
  current: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium
        transition-colors duration-150
        ${current
          ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      <span className="flex items-center gap-3">
        <span className="text-base leading-none">{icon}</span>
        <span>{label}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className={`
          text-xs px-1.5 py-0.5 rounded-full font-semibold
          ${current
            ? "bg-white/20 text-white"
            : "bg-red-100 text-red-600"
          }
        `}>
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authStatus = useAdminAuth();
  const [pendingManufacturerCount, setPendingManufacturerCount] = useState(0);

  useEffect(() => {
    if (authStatus !== "ok") return;
    const token = localStorage.getItem("loocbooc_token") ?? "";
    fetch("/api/v1/admin/manufacturers/pending", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { data?: unknown[] }) => {
        setPendingManufacturerCount(d.data?.length ?? 0);
      })
      .catch(() => null);
  }, [authStatus]);

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--loocbooc-black)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthorized") {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">
            Admin access required
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">
            This area is restricted to Loocbooc platform administrators.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      label: "Platform",
      items: [
        { href: "/admin", label: "Overview", icon: "📊", badge: undefined },
        { href: "/admin/activity", label: "Activity", icon: "📡", badge: undefined },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/campaigns", label: "Campaigns", icon: "🚀", badge: undefined },
        {
          href: "/admin/manufacturers",
          label: "Manufacturers",
          icon: "🏭",
          badge: pendingManufacturerCount > 0 ? pendingManufacturerCount : undefined,
        },
        { href: "/admin/users", label: "Users", icon: "👤", badge: undefined },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface-2)] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[var(--loocbooc-white)] border-r border-[var(--surface-3)] flex flex-col">
        {/* Brand mark */}
        <div className="px-5 py-5 border-b border-[var(--surface-3)]">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg tracking-tight text-[var(--loocbooc-black)]">
              loocbooc
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
              admin
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    current={
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Back to app */}
        <div className="px-3 py-4 border-t border-[var(--surface-3)]">
          <Link
            href="/plm"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span>←</span>
            <span>Exit admin</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
