/**
 * Brand portal layout — wraps all brand-facing dashboard pages.
 *
 * Full sidebar navigation. Auth-enforces brand role.
 * Links to all active brand modules: PLM, Campaigns (Back It), Manufacturers.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────
// Auth gate
// ─────────────────────────────────────────────

function useBrandAuth() {
  const [status, setStatus] = useState<"loading" | "ok" | "unauthorized">("loading");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("loocbooc_token") : null;
    if (!token) { setStatus("unauthorized"); return; }

    fetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { role?: string }) => {
        setStatus(data.role === "brand_owner" || data.role === "brand_member" ? "ok" : "unauthorized");
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
}: {
  href: string;
  label: string;
  icon: string;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium
        transition-colors duration-[var(--duration-fast)]
        ${current
          ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authStatus = useBrandAuth();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--loocbooc-black)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthorized") {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">
            Brand access required
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">
            This area is for brand accounts only.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      label: "Production",
      items: [
        { href: "/plm", label: "PLM Dashboard", icon: "📋" },
      ],
    },
    {
      label: "Campaigns",
      items: [
        { href: "/campaigns", label: "Back It Campaigns", icon: "🚀" },
      ],
    },
    {
      label: "Manufacturers",
      items: [
        { href: "/manufacturers", label: "Find Manufacturers", icon: "🔍" },
        { href: "/manufacturers/connections", label: "My Connections", icon: "🤝" },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/size-charts", label: "Size Charts", icon: "📐" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[var(--surface-3)] flex flex-col">
        {/* Brand mark */}
        <div className="px-5 py-5 border-b border-[var(--surface-3)]">
          <Link href="/plm" className="flex items-center gap-2">
            <span className="font-display text-lg tracking-tight text-[var(--loocbooc-black)]">
              loocbooc
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-tertiary)] rounded font-medium">
              brand
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    current={
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-[var(--surface-3)]">
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span>⚙</span>
            <span>Settings</span>
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
