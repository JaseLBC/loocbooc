"use client";

/**
 * Reset password page — two stages:
 *
 * Stage 1 (no token): Email input form.
 *   - Calls supabase.auth.resetPasswordForEmail()
 *   - Shows success message
 *
 * Stage 2 (has token_hash in URL): New password form.
 *   - This page is the redirect target in the reset email
 *   - Calls supabase.auth.updateUser({ password })
 *   - On success, redirects to /auth/login
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createBrowserClient(url, key);
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // If token_hash is present, we're in the "set new password" flow
  const tokenHash = searchParams.get("token_hash");
  const isSetNew = Boolean(tokenHash);

  // Stage 1: request reset
  const [email, setEmail] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Stage 2: set new password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setSubmitting, setSetSubmitting] = useState(false);
  const [setError, setSetError] = useState<string | null>(null);
  const [setSuccess, setSetSuccess] = useState(false);

  // If we have a token hash, verify it on mount
  useEffect(() => {
    if (!tokenHash) return;
    async function verifyToken() {
      const supabase = getSupabase();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: "recovery",
      });
      if (error) {
        setSetError("This reset link is invalid or has expired. Please request a new one.");
      }
    }
    void verifyToken();
  }, [tokenHash]);

  const handleRequestReset = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setRequestError(null);
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        setRequestError("Please enter your email address.");
        return;
      }
      setRequestSubmitting(true);
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) {
          setRequestError(error.message);
        } else {
          setRequestSent(true);
        }
      } catch {
        setRequestError("Something went wrong. Please try again.");
      } finally {
        setRequestSubmitting(false);
      }
    },
    [email],
  );

  const handleSetNewPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSetError(null);

      if (newPassword.length < 10) {
        setSetError("Password must be at least 10 characters.");
        return;
      }
      if (!/[A-Z]/.test(newPassword)) {
        setSetError("Password must contain at least one uppercase letter.");
        return;
      }
      if (!/[0-9]/.test(newPassword)) {
        setSetError("Password must contain at least one number.");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(newPassword)) {
        setSetError("Password must contain at least one special character.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setSetError("Passwords don't match.");
        return;
      }

      setSetSubmitting(true);
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          setSetError(error.message);
        } else {
          setSetSuccess(true);
          setTimeout(() => router.replace("/auth/login"), 2000);
        }
      } catch {
        setSetError("Failed to update password. Please try again.");
      } finally {
        setSetSubmitting(false);
      }
    },
    [newPassword, confirmPassword, router],
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 20px",
        background: "#fff",
        minHeight: "100dvh",
      }}
    >
      {/* Logo */}
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

      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* ── Stage 1: Request password reset ── */}
        {!isSetNew && !requestSent && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, color: "#0a0a0a" }}>
              Reset your password
            </h1>
            <p style={{ fontSize: 15, color: "#666", marginBottom: 32 }}>
              Enter your email address and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={(e) => void handleRequestReset(e)} noValidate>
              <div style={{ marginBottom: 20 }}>
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
                  disabled={requestSubmitting}
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

              {requestError && (
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
                  {requestError}
                </div>
              )}

              <button
                type="submit"
                disabled={requestSubmitting}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "14px 20px",
                  background: requestSubmitting ? "#555" : "#0a0a0a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: requestSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {requestSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        {/* ── Stage 1 success ── */}
        {!isSetNew && requestSent && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>📩</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, color: "#0a0a0a" }}>
              Check your email
            </h2>
            <p style={{ fontSize: 15, color: "#555", marginBottom: 32, lineHeight: 1.6 }}>
              We&apos;ve sent a password reset link to <strong>{email}</strong>. 
              Click the link in the email to set a new password.
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
        )}

        {/* ── Stage 2: Set new password ── */}
        {isSetNew && !setSuccess && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, color: "#0a0a0a" }}>
              Set new password
            </h1>
            <p style={{ fontSize: 15, color: "#666", marginBottom: 32 }}>
              Choose a strong password for your account.
            </p>

            {setError && (
              <div
                style={{
                  marginBottom: 20,
                  padding: "11px 14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  color: "#dc2626",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {setError}
                {setError.includes("expired") && (
                  <div style={{ marginTop: 8 }}>
                    <Link href="/auth/reset-password" style={{ color: "#dc2626", fontWeight: 600 }}>
                      Request a new link
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={(e) => void handleSetNewPassword(e)} noValidate>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="newPassword"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1a1a1a",
                    marginBottom: 6,
                  }}
                >
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="10+ characters"
                  disabled={setSubmitting}
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
                  disabled={setSubmitting}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 14px",
                    border: `1.5px solid ${confirmPassword && confirmPassword !== newPassword ? "#ef4444" : "#e5e5e5"}`,
                    borderRadius: 10,
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#0a0a0a"; }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      confirmPassword && confirmPassword !== newPassword ? "#ef4444" : "#e5e5e5";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={setSubmitting}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "14px 20px",
                  background: setSubmitting ? "#555" : "#0a0a0a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: setSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {setSubmitting ? "Updating..." : "Set new password"}
              </button>
            </form>
          </>
        )}

        {/* ── Stage 2 success ── */}
        {isSetNew && setSuccess && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, color: "#0a0a0a" }}>
              Password updated
            </h2>
            <p style={{ fontSize: 15, color: "#555", marginBottom: 24 }}>
              Your password has been changed. Redirecting to login...
            </p>
          </div>
        )}

        {/* Back to login */}
        {!requestSent && !setSuccess && (
          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#666",
              marginTop: 28,
            }}
          >
            <Link href="/auth/login" style={{ color: "#0a0a0a", fontWeight: 600, textDecoration: "none" }}>
              ← Back to login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
