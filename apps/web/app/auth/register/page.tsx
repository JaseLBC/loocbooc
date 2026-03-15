"use client";

/**
 * Register page.
 *
 * Supports consumer, brand, and manufacturer account types.
 * The `type` query param pre-selects the account type tab.
 *
 * Flow:
 * 1. User enters email + password + name + optional account type
 * 2. signUp() creates Supabase Auth account
 * 3. API /auth/register creates the DB record with the correct role
 * 4. On success → email verification prompt (Supabase sends the email)
 * 5. If user is already logged in → redirect immediately
 *
 * Password policy (mirrors backend):
 * - Minimum 10 characters
 * - At least one uppercase, one lowercase, one number, one special char
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/auth";

// ─────────────────────────────────────────────
// Google logo
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
// Types
// ─────────────────────────────────────────────

type AccountType = "consumer" | "brand" | "manufacturer";

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "consumer",
    label: "Shopper",
    description: "Back styles, get fit recommendations, shop pre-production",
    icon: "👗",
  },
  {
    value: "brand",
    label: "Brand",
    description: "Run Back It campaigns, manage production, find manufacturers",
    icon: "✨",
  },
  {
    value: "manufacturer",
    label: "Manufacturer",
    description: "List your capabilities, receive orders from brands",
    icon: "🏭",
  },
];

// Password strength checker
function checkPasswordStrength(password: string): {
  score: number; // 0–4
  message: string;
  color: string;
} {
  if (password.length === 0) return { score: 0, message: "", color: "#e5e5e5" };
  if (password.length < 8) return { score: 1, message: "Too short", color: "#ef4444" };

  let score = 0;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 2, message: "Weak", color: "#f97316" };
  if (score === 3) return { score: 3, message: "Good", color: "#eab308" };
  if (score >= 4) return { score: 4, message: "Strong", color: "#22c55e" };
  return { score: 1, message: "Too short", color: "#ef4444" };
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/explore";
  const typeParam = (searchParams.get("type") as AccountType | null) ?? "consumer";

  const { signUp, signInWithGoogle, user, isLoading: authLoading } = useAuth();

  const [accountType, setAccountType] = useState<AccountType>(typeParam);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordStrength = checkPasswordStrength(password);

  // If already logged in, redirect
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, redirectTo]);

  const validate = useCallback((): string | null => {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!email.trim()) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address.";
    if (password.length < 10) return "Password must be at least 10 characters.";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
    if (password !== confirmPassword) return "Passwords don't match.";
    if (accountType === "brand" && !brandName.trim()) return "Please enter your brand name.";
    return null;
  }, [fullName, email, password, confirmPassword, accountType, brandName]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      setSubmitting(true);

      // Supabase auth signup
      const { error: signUpError } = await signUp(
        email.trim().toLowerCase(),
        password,
        {
          fullName: fullName.trim(),
        },
      );

      if (signUpError) {
        setError(signUpError);
        setSubmitting(false);
        return;
      }

      // Register with our API to set the role and create DB record
      try {
        const res = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            role: accountType === "consumer" ? "CONSUMER"
              : accountType === "brand" ? "BRAND_OWNER"
              : "MANUFACTURER",
            brandName: accountType === "brand" ? brandName.trim() : undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json() as { error?: { message?: string } };
          console.warn("API register failed:", data.error?.message);
          // Non-fatal — Supabase account was still created
        }
      } catch {
        // Non-fatal — proceed anyway
      }

      setSuccess(true);
      setSubmitting(false);
    },
    [validate, signUp, email, password, fullName, accountType, brandName],
  );

  const handleGoogle = useCallback(async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setError(oauthError);
      setGoogleLoading(false);
    }
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

  // Success state — awaiting email confirmation
  if (success) {
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
        <div style={{ paddingTop: 52, paddingBottom: 40, textAlign: "center" }}>
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
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📩</div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 10,
              color: "#0a0a0a",
            }}
          >
            Check your email
          </h1>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6, marginBottom: 28 }}>
            We&apos;ve sent a confirmation link to{" "}
            <strong>{email}</strong>. Click the link to activate your account.
          </p>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
            Didn&apos;t get it? Check your spam folder, or{" "}
            <button
              onClick={() => setSuccess(false)}
              style={{
                background: "none",
                border: "none",
                color: "#0a0a0a",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
                textDecoration: "underline",
              }}
            >
              try again
            </button>
            .
          </p>
          <Link
            href="/auth/login"
            style={{
              display: "inline-block",
              padding: "13px 32px",
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
        </div>
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
      <div style={{ paddingTop: 52, paddingBottom: 32, textAlign: "center" }}>
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

      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 6,
            color: "#0a0a0a",
          }}
        >
          Create your account
        </h1>
        <p style={{ fontSize: 15, color: "#666", marginBottom: 28 }}>
          Join the platform where fashion is made.
        </p>

        {/* Account type tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 28,
            background: "#f5f5f5",
            borderRadius: 12,
            padding: 4,
          }}
        >
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setAccountType(type.value)}
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: 9,
                border: "none",
                background:
                  accountType === type.value ? "#fff" : "transparent",
                color: accountType === type.value ? "#0a0a0a" : "#888",
                fontWeight: accountType === type.value ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                boxShadow:
                  accountType === type.value
                    ? "0 1px 4px rgba(0,0,0,0.1)"
                    : "none",
                transition: "all 0.18s",
              }}
            >
              {type.icon} {type.label}
            </button>
          ))}
        </div>

        {/* Account type description */}
        <p
          style={{
            fontSize: 13,
            color: "#666",
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          {ACCOUNT_TYPES.find((t) => t.value === accountType)?.description}
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
            background: "#fff",
            color: "#1a1a1a",
            fontSize: 15,
            fontWeight: 500,
            cursor: googleLoading || submitting ? "not-allowed" : "pointer",
            marginBottom: 20,
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

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          {/* Full name */}
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="fullName"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
                marginBottom: 6,
              }}
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
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
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; }}
            />
          </div>

          {/* Brand name (brand accounts only) */}
          {accountType === "brand" && (
            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="brandName"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  marginBottom: 6,
                }}
              >
                Brand name
              </label>
              <input
                id="brandName"
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Your brand's name"
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
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; }}
              />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
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
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="10+ characters"
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
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; }}
            />
            {/* Password strength bar */}
            {password.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: "#f0f0f0",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      height: "100%",
                      background: passwordStrength.color,
                      borderRadius: 2,
                      transition: "width 0.3s, background 0.3s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: passwordStrength.color,
                    minWidth: 40,
                  }}
                >
                  {passwordStrength.message}
                </span>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="confirmPassword"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
                marginBottom: 6,
              }}
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Same again"
              disabled={submitting}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 14px",
                border: `1.5px solid ${confirmPassword && confirmPassword !== password ? "#ef4444" : "#e5e5e5"}`,
                borderRadius: 10,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  confirmPassword && confirmPassword !== password ? "#ef4444" : "#e5e5e5";
              }}
            />
            {confirmPassword && confirmPassword !== password && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                Passwords don&apos;t match
              </p>
            )}
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
              background: submitting || googleLoading ? "#555" : "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting || googleLoading ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>

          {/* Terms */}
          <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 16, lineHeight: 1.5 }}>
            By creating an account you agree to our{" "}
            <Link href="/legal/terms" style={{ color: "#888", textDecoration: "underline" }}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" style={{ color: "#888", textDecoration: "underline" }}>
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        {/* Login link */}
        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#666",
            marginTop: 28,
            paddingBottom: 40,
          }}
        >
          Already have an account?{" "}
          <Link
            href="/auth/login"
            style={{ color: "#0a0a0a", fontWeight: 600, textDecoration: "none" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
