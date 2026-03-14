/**
 * Manufacturer portal layout.
 *
 * Full sidebar navigation with auth enforcement.
 * Manufacturers land here after login — this is their operating base.
 *
 * Nav sections:
 *   - Dashboard (overview)
 *   - Connections (incoming enquiries + active connections)
 *   - Profile (edit all profile fields)
 *
 * Design: Loocbooc design tokens throughout.
 * The sidebar is fixed, the main content scrolls.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────
// Auth gate — redirect to login if not a manufacturer
// ─────────────────────────────────────────────

function useManufacturerAuth() {
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
        if (data.role === "manufacturer") {
          setStatus("ok");
        } else {
          setStatus("unauthorized");
        }
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
  badge,
  current,
}: {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium
        transition-colors duration-[var(--duration-fast)] group
        ${
          current
            ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`
            inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold
            ${current ? "bg-white/20 text-white" : "bg-[var(--loocbooc-accent)] text-[var(--loocbooc-black)]"}
          `}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────
// Layout shell
// ─────────────────────────────────────────────

export default function ManufacturerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authStatus = useManufacturerAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending enquiry count for badge
  useEffect(() => {
    if (authStatus !== "ok") return;
    const token = typeof window !== "undefined" ? localStorage.getItem("loocbooc_token") : null;
    if (!token) return;

    fetch("/api/v1/manufacturers/my-enquiries", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { data?: Array<{ status: string }> }) => {
        const pending = (data.data ?? []).filter((c) => c.status === "ENQUIRY").length;
        setPendingCount(pending);
      })
      .catch(() => {/* non-fatal */});
  }, [authStatus]);

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--loocbooc-black)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)] text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthorized") {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">
            Manufacturer access required
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">
            This area is for verified manufacturers only.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in as manufacturer
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/manufacturer/dashboard", label: "Dashboard", icon: "⊞" },
    {
      href: "/manufacturer/connections",
      label: "Connections",
      icon: "🤝",
      badge: pendingCount,
    },
    { href: "/manufacturer/profile", label: "Profile", icon: "✎" },
  ];

  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[var(--surface-3)] flex flex-col">
        {/* Brand mark */}
        <div className="px-5 py-5 border-b border-[var(--surface-3)]">
          <Link href="/manufacturer/dashboard" className="flex items-center gap-2">
            <span className="font-display text-lg tracking-tight text-[var(--loocbooc-black)]">
              loocbooc
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-tertiary)] rounded font-medium">
              mfr
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              current={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          ))}
        </nav>

        {/* Bottom: platform link */}
        <div className="px-3 py-4 border-t border-[var(--surface-3)]">
          <Link
            href="/manufacturers"
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span>🔍</span>
            <span>Browse marketplace</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
