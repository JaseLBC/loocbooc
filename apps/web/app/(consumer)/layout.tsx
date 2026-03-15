"use client";

/**
 * Consumer layout — wraps all consumer-facing pages.
 *
 * Provides:
 * - AuthProvider wrapper (auth context available to all children)
 * - Bottom navigation bar with 4 tabs: Explore, Back It (active), My Style, Avatar
 * - Active tab highlighting based on current path
 * - Mobile-first: tabs visible on mobile, hidden on desktop (nav bar takes over)
 *
 * Navigation tabs:
 *   /explore        — Browse active campaigns
 *   /style          — My taste profile + personalised recommendations
 *   /avatar         — My avatar + fit recommendations
 *   /auth/login     — Sign in (shown when not logged in)
 *
 * The layout does NOT hard-redirect unauthenticated users — most consumer pages
 * are accessible without an account (explore, campaign view). Backing requires auth.
 */

import React from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider } from "../../lib/auth";

// ─────────────────────────────────────────────
// Nav tabs config
// ─────────────────────────────────────────────

interface NavTab {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  matchPaths: string[];
}

const NAV_TABS: NavTab[] = [
  {
    href: "/explore",
    label: "Explore",
    matchPaths: ["/explore"],
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0a0a0a" : "#aaa"}
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: "/style",
    label: "My Style",
    matchPaths: ["/style"],
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0a0a0a" : "#aaa"}
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    href: "/avatar",
    label: "Avatar",
    matchPaths: ["/avatar"],
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0a0a0a" : "#aaa"}
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// ─────────────────────────────────────────────
// Bottom nav bar
// ─────────────────────────────────────────────

function BottomNav() {
  const pathname = usePathname();

  // Hide bottom nav on full-screen wizard pages (avatar create, backing form)
  const hideOnPaths = ["/avatar/create", "/back/"];
  if (hideOnPaths.some((p) => pathname.includes(p))) {
    return null;
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#fff",
        borderTop: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "stretch",
        zIndex: 100,
        // Safe area inset for iPhone home indicator
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        // Hide on larger screens — desktop has a different nav
        // Using inline style because we want CSS media query behaviour
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <style>{`
        @media (min-width: 768px) {
          .looc-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
      <div
        className="looc-bottom-nav"
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {NAV_TABS.map((tab) => {
          const isActive = tab.matchPaths.some((p) =>
            pathname === p || pathname.startsWith(p + "/"),
          );
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 0 6px",
                textDecoration: "none",
                position: "relative",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#0a0a0a",
                  }}
                />
              )}
              <div style={{ marginTop: 4 }}>
                {tab.icon(isActive)}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#0a0a0a" : "#aaa",
                  marginTop: 3,
                  letterSpacing: "0.01em",
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div
        style={{
          minHeight: "100dvh",
          background: "#fff",
          // Bottom nav clearance on mobile
          paddingBottom: "calc(66px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </div>
      <BottomNav />
    </AuthProvider>
  );
}
