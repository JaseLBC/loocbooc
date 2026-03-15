"use client";

/**
 * Auth callback page — handles Supabase OAuth redirects and email confirmation links.
 *
 * Supabase redirects here with either:
 *   ?code=<pkce_code>          → OAuth callback (Google, etc.)
 *   ?token_hash=<hash>         → Email confirmation / magic link
 *   ?error=<error>&error_description=<desc> → Auth error
 *
 * Flow:
 * 1. Exchange PKCE code or token hash for a session
 * 2. Call /api/v1/auth/me to get the user's role
 * 3. Route to the correct dashboard based on role
 *
 * If something goes wrong, show a clear error with a link back to login.
 */

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type CallbackState = "processing" | "success" | "error";

// Supabase browser client for code exchange
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createBrowserClient(url, key);
}

// Role → redirect path
function getRedirectForRole(role: string, fallback: string): string {
  switch (role) {
    case "BRAND_OWNER":
    case "BRAND_MEMBER":
      return "/plm";
    case "MANUFACTURER":
      return "/dashboard";
    case "PLATFORM_ADMIN":
      return "/admin";
    default:
      return fallback;
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const supabase = getSupabase();

      // Check for errors from the OAuth provider
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      if (error) {
        setState("error");
        setErrorMessage(errorDescription ?? error);
        return;
      }

      // PKCE code exchange (OAuth flows)
      const code = searchParams.get("code");
      // Token hash (email confirmation, magic links)
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      // Where to go after auth
      const next = searchParams.get("next") ?? "/explore";

      try {
        if (code) {
          // Exchange PKCE code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw new Error(exchangeError.message);
          }
        } else if (tokenHash) {
          // Verify email confirmation / magic link
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "email" | "recovery" | "email_change") ?? "email",
          });
          if (verifyError) {
            throw new Error(verifyError.message);
          }
        } else {
          // No code or token — just check if there's a session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error("No authentication data found. Please try signing in again.");
          }
        }

        // Get current session to determine role
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Session could not be established. Please try again.");
        }

        // Fetch user role from our API
        let redirectPath = next;
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
          const meRes = await fetch(`${apiUrl}/api/v1/auth/me`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (meRes.ok) {
            const meData = await meRes.json() as { user?: { role?: string } };
            const role = meData.user?.role ?? "CONSUMER";
            redirectPath = getRedirectForRole(role, next);
          }
        } catch {
          // Non-fatal — fall through to default redirect
        }

        setState("success");
        // Short delay so user sees success state
        setTimeout(() => {
          router.replace(redirectPath);
        }, 800);
      } catch (err) {
        setState("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Authentication failed. Please try again.",
        );
      }
    }

    void handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
        background: "#fff",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 40 }}>
        <Link
          href="/"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#0a0a0a",
            textDecoration: "none",
          }}
        >
          loocbooc
        </Link>
      </div>

      {state === "processing" && (
        <div style={{ textAlign: "center" }}>
          {/* Animated spinner */}
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #f0f0f0",
              borderTopColor: "#0a0a0a",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <p style={{ fontSize: 16, fontWeight: 500, color: "#0a0a0a", marginBottom: 6 }}>
            Signing you in...
          </p>
          <p style={{ fontSize: 14, color: "#888" }}>
            Just a moment.
          </p>
        </div>
      )}

      {state === "success" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#0a0a0a", marginBottom: 6 }}>
            Signed in
          </p>
          <p style={{ fontSize: 14, color: "#888" }}>
            Redirecting you now...
          </p>
        </div>
      )}

      {state === "error" && (
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#0a0a0a",
              marginBottom: 10,
            }}
          >
            Sign-in failed
          </h2>
          {errorMessage && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#dc2626",
                fontSize: 14,
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              {errorMessage}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href="/auth/login"
              style={{
                display: "block",
                padding: "13px 24px",
                background: "#0a0a0a",
                color: "#fff",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Back to login
            </Link>
            <Link
              href="/auth/register"
              style={{
                display: "block",
                padding: "13px 24px",
                background: "transparent",
                color: "#555",
                border: "1.5px solid #e5e5e5",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 15,
              }}
            >
              Create an account
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
