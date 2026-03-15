"use client";

/**
 * Root page — auth-aware redirect.
 *
 * Authenticated users → routed to their role-specific dashboard.
 * Unauthenticated users → redirected to /explore (public campaign browse).
 *
 * The AuthProvider is here because this is outside the (consumer) route group.
 * We use a tiny auth-check to avoid a flash of the wrong content.
 */

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../lib/auth";

function RootRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/explore");
      return;
    }

    // Route by role
    const role = (user as unknown as { role?: string }).role ?? "CONSUMER";
    switch (role) {
      case "BRAND_OWNER":
      case "BRAND_MEMBER":
        router.replace("/plm");
        break;
      case "MANUFACTURER":
        router.replace("/dashboard");
        break;
      case "PLATFORM_ADMIN":
        router.replace("/admin");
        break;
      default:
        router.replace("/explore");
    }
  }, [isLoading, user, router]);

  // Minimal loading state while auth resolves
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#0a0a0a",
          letterSpacing: "-0.02em",
          opacity: 0.4,
        }}
      >
        loocbooc
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <RootRedirect />
    </AuthProvider>
  );
}
