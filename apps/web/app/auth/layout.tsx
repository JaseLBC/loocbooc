"use client";

/**
 * Auth layout — wraps all auth pages (login, register, callback, reset-password).
 * Provides AuthProvider context so useAuth() works on auth pages.
 */

import type { ReactNode } from "react";
import { AuthProvider } from "../../lib/auth";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div
        style={{
          minHeight: "100dvh",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {children}
      </div>
    </AuthProvider>
  );
}
