"use client";

/**
 * Login page.
 *
 * Supports:
 * - Email + password sign-in
 * - Google OAuth
 * - "Forgot password" link
 * - Redirect to ?redirect= param on success (or /explore by default)
 *
 * Uses the AuthContext signIn / signInWithGoogle methods.
 * Shows a role-detection message: after auth, the API /me response
 * routes the user to the correct dashboard (brand vs consumer vs manufacturer).
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/auth";

// ─────────────────────────────────────────────
// Google "G" logo SVG
// ─────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/explore";

  const { signIn, signInWithGoogle, user, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, redirectTo]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);

      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !password) {
        setError("Please enter your email and password.");
        setSubmitting(false);
        return;
      }

      const { error: signInError } = await signIn(trimmedEmail, password);
      if (signInError) {
        setError(signInError);
        setSubmitting(false);
        return;
      }

      // signIn succeeded — auth context will update, useEffect will redirect
      router.replace(redirectTo);
    },
    [email, password, signIn, router, redirectTo],
  );

  const handleGoogle = useCallback(async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setError(oauthError);
      setGoogleLoading(false);
    }
    // On success, Supabase redirects to /auth/callback — loading stays true
  }, [signInWithGoogle]);

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#888", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 20px",
      }}
    >
      {/* Logo */}
      <div
        style={{
          paddingTop: 52,
          paddingBottom: 40,
          textAlign: "center",
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#0a0a0a",
            textDecoration: "none",
          }}
        >
          loocbooc
        </Link>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 6,
            color: "#0a0a0a",
            lineHeight: 1.2,
          }}
        >
          Welcome back
        </h1>
        <p style={{ fontSize: 15, color: "#666", marginBottom: 32 }}>
          Sign in to your account to continue.
        </p>

        {/* Google OAuth */}
        <button
          onClick={() => void handleGoogle()}
          disabled={googleLoading || submitting}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "13px 20px",
            border: "1.5px solid #e5e5e5",
            borderRadius: 10,
            background: googleLoading ? "#f9f9f9" : "#fff",
            color: "#1a1a1a",
            fontSize: 15,
            fontWeight: 500,
            cursor: googleLoading || submitting ? "not-allowed" : "pointer",
            marginBottom: 20,
            transition: "border-color 0.2s",
          }}
        >
          {googleLoading ? (
            <span style={{ fontSize: 14, color: "#888" }}>Redirecting...</span>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
          <span style={{ fontSize: 13, color: "#999" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid #e5e5e5",
                borderRadius: 10,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                color: "#0a0a0a",
                background: submitting ? "#fafafa" : "#fff",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0a0a0a";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e5e5e5";
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 8 }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid #e5e5e5",
                borderRadius: 10,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                color: "#0a0a0a",
                background: submitting ? "#fafafa" : "#fff",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0a0a0a";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e5e5e5";
              }}
            />
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginBottom: 24 }}>
            <Link
              href="/auth/reset-password"
              style={{
                fontSize: 13,
                color: "#666",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "11px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#dc2626",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || googleLoading}
            style={{
              display: "block",
              width: "100%",
              padding: "14px 20px",
              background:
                submitting || googleLoading ? "#555" : "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor:
                submitting || googleLoading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Register link */}
        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#666",
            marginTop: 28,
          }}
        >
          Don&apos;t have an account?{" "}
          <Link
            href={`/auth/register${redirectTo !== "/explore" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            style={{ color: "#0a0a0a", fontWeight: 600, textDecoration: "none" }}
          >
            Create one
          </Link>
        </p>

        {/* Brand / manufacturer login note */}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#aaa",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Brand or manufacturer?{" "}
          <Link
            href="/auth/register?type=brand"
            style={{ color: "#888", textDecoration: "underline" }}
          >
            Sign up as a brand
          </Link>{" "}
          ·{" "}
          <Link
            href="/auth/register?type=manufacturer"
            style={{ color: "#888", textDecoration: "underline" }}
          >
            as a manufacturer
          </Link>
        </p>
      </div>
    </div>
  );
}
