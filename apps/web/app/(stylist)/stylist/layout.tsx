"use client";

/**
 * Stylist portal shell — nav sidebar + mobile bottom nav.
 *
 * Authenticated check: redirects to /auth/login if not signed in as a stylist.
 * The sidebar collapses to a bottom tab bar on mobile.
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface StylistProfile {
  id: string;
  displayName: string;
  verified: boolean;
  isAvailable: boolean;
  completedBriefs: number;
  avgRating: number | null;
}

const NAV_ITEMS = [
  { href: "/stylist/dashboard",    icon: "🏠", label: "Dashboard" },
  { href: "/stylist/briefs",       icon: "📋", label: "Briefs" },
  { href: "/stylist/portfolio",    icon: "🖼️", label: "Portfolio" },
  { href: "/stylist/commissions",  icon: "💰", label: "Earnings" },
];

export default function StylistPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [stylist, setStylist] = useState<StylistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notStylist, setNotStylist] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/stylists/me", { credentials: "include" });
        if (res.status === 401) {
          window.location.href = "/auth/login?redirect=/stylist/dashboard";
          return;
        }
        if (res.status === 404) {
          setNotStylist(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json() as { stylist: StylistProfile };
        setStylist(data.stylist);
      } catch {
        setNotStylist(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888", fontSize: 14 }}>Loading portal…</div>
      </div>
    );
  }

  if (notStylist) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✂️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Become a stylist</h1>
          <p style={{ color: "#666", fontSize: 15, marginBottom: 24 }}>
            You don&apos;t have a stylist profile yet. Apply to join the Loocbooc Styling Marketplace.
          </p>
          <a
            href="/api/v1/stylists"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              background: "#0a0a0a",
              color: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Apply now
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fafafa", display: "flex", flexDirection: "column" }}>
      {/* Desktop: top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 56,
        background: "#fff",
        borderBottom: "1px solid #e5e5e5",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <Link href="/stylist/dashboard" style={{ fontWeight: 800, fontSize: 17, textDecoration: "none", color: "#0a0a0a", letterSpacing: "-0.02em" }}>
          loocbooc <span style={{ fontWeight: 400, fontSize: 12, color: "#888" }}>stylist</span>
        </Link>

        {/* Nav — desktop */}
        <nav style={{ display: "flex", gap: 4 }}>
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0a0a0a" : "#666",
                  background: active ? "#f4f4f5" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Stylist info */}
        {stylist && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            {stylist.verified && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 20 }}>
                VERIFIED
              </span>
            )}
            <span style={{ color: "#555" }}>{stylist.displayName}</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, paddingBottom: 72 }}>
        {children}
      </div>

      {/* Mobile: bottom tab bar */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "#fff",
        borderTop: "1px solid #e5e5e5",
        display: "flex",
        zIndex: 50,
      }}>
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: active ? "#0a0a0a" : "#9ca3af",
              }}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
