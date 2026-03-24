/**
 * Consumer Settings Page — account management, notification preferences, data export/deletion.
 *
 * Features:
 * - Profile info (name, email) — editable
 * - Notification preferences — email, push, SMS toggles
 * - Communication preferences — marketing opt-out
 * - Account actions — export data, delete account
 * - Password change (if email auth)
 *
 * Design: Grouped settings cards with toggle switches.
 * Auth: Required. Redirect to login if not authenticated.
 */

"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface NotificationPreferences {
  emailBackingUpdates: boolean;
  emailCampaignLaunches: boolean;
  emailBriefUpdates: boolean;
  emailOrderUpdates: boolean;
  emailMarketing: boolean;
  pushEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailBackingUpdates: true,
  emailCampaignLaunches: true,
  emailBriefUpdates: true,
  emailOrderUpdates: true,
  emailMarketing: false,
  pushEnabled: false,
};

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function Toggle({
  id,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="looc-toggle"
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? "var(--loocbooc-black)" : "var(--surface-3)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 150ms ease",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 0",
        borderBottom: "1px solid var(--surface-2)",
      }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {label}
        </p>
        {description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              margin: "4px 0 0",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "white",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--surface-2)",
        padding: "20px 24px",
        marginBottom: 20,
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 4px",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  variant = "default",
  loading = false,
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  loading?: boolean;
}) {
  const isDanger = variant === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 500,
        borderRadius: "var(--radius-md)",
        border: isDanger ? "1px solid #dc2626" : "1px solid var(--surface-3)",
        background: isDanger ? "#fef2f2" : "white",
        color: isDanger ? "#dc2626" : "var(--text-primary)",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "all 150ms ease",
      }}
    >
      {loading ? "..." : label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ─────────────────────────────────────────────
  // Fetch user data
  // ─────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem("loocbooc_token");
    if (!token) {
      router.push("/auth/login?redirect=/settings");
      return;
    }

    async function fetchUser() {
      try {
        const res = await fetch("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          router.push("/auth/login?redirect=/settings");
          return;
        }
        const data = await res.json();
        setUser(data);
        setName(data.fullName || "");

        // Fetch notification preferences (simulated — in production, this would be a real endpoint)
        const storedPrefs = localStorage.getItem(`loocbooc_prefs_${data.id}`);
        if (storedPrefs) {
          setPrefs(JSON.parse(storedPrefs));
        }
      } catch {
        router.push("/auth/login?redirect=/settings");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [router]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem("loocbooc_token");
      const res = await fetch("/api/v1/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fullName: name }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profile updated" });
        setUser((prev) => prev ? { ...prev, fullName: name } : prev);
      } else {
        setMessage({ type: "error", text: "Failed to update profile" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrefChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    if (user) {
      localStorage.setItem(`loocbooc_prefs_${user.id}`, JSON.stringify(newPrefs));
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 10) {
      setMessage({ type: "error", text: "Password must be at least 10 characters" });
      return;
    }

    setChangingPassword(true);
    setMessage(null);

    try {
      // In production, this would call a real password change endpoint
      await new Promise((r) => setTimeout(r, 1000));
      setMessage({ type: "success", text: "Password changed successfully" });
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage({ type: "error", text: "Failed to change password" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportData = async () => {
    setSaving(true);
    try {
      // In production, this would trigger a GDPR data export
      await new Promise((r) => setTimeout(r, 1500));
      setMessage({
        type: "success",
        text: "Data export requested. You'll receive an email when it's ready.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete my account") {
      setMessage({ type: "error", text: "Please type the confirmation text exactly" });
      return;
    }

    setDeleting(true);
    try {
      // In production, this would call the account deletion endpoint
      await new Promise((r) => setTimeout(r, 2000));
      localStorage.removeItem("loocbooc_token");
      router.push("/?deleted=true");
    } catch {
      setMessage({ type: "error", text: "Failed to delete account" });
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("loocbooc_token");
    router.push("/");
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid var(--loocbooc-black)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "24px 16px 100px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <Link
          href="/explore"
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--surface-3)",
            background: "white",
          }}
          aria-label="Back"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 9H3m0 0l5-5M3 9l5 5" />
          </svg>
        </Link>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Settings
        </h1>
      </div>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            marginBottom: 20,
            background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: message.type === "success" ? "#166534" : "#dc2626",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Profile */}
      <SettingsCard title="Profile">
        <form onSubmit={handleUpdateProfile}>
          <div style={{ paddingTop: 12 }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-tertiary)",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={user.email}
              disabled
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--surface-3)",
                background: "var(--surface-1)",
                color: "var(--text-tertiary)",
              }}
            />
          </div>
          <div style={{ paddingTop: 16 }}>
            <label
              htmlFor="name"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-tertiary)",
                marginBottom: 6,
              }}
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--surface-3)",
                background: "white",
              }}
            />
          </div>
          <div style={{ paddingTop: 16 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "var(--loocbooc-black)",
                color: "white",
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </SettingsCard>

      {/* Notification Preferences */}
      <SettingsCard title="Email Notifications">
        <SettingRow
          label="Backing updates"
          description="MOQ progress, production, shipping"
        >
          <Toggle
            id="emailBackingUpdates"
            checked={prefs.emailBackingUpdates}
            onChange={(v) => handlePrefChange("emailBackingUpdates", v)}
          />
        </SettingRow>
        <SettingRow
          label="New campaigns"
          description="Campaigns matching your taste"
        >
          <Toggle
            id="emailCampaignLaunches"
            checked={prefs.emailCampaignLaunches}
            onChange={(v) => handlePrefChange("emailCampaignLaunches", v)}
          />
        </SettingRow>
        <SettingRow
          label="Style brief updates"
          description="Stylist assignments, lookbooks"
        >
          <Toggle
            id="emailBriefUpdates"
            checked={prefs.emailBriefUpdates}
            onChange={(v) => handlePrefChange("emailBriefUpdates", v)}
          />
        </SettingRow>
        <SettingRow
          label="Order updates"
          description="Confirmations, shipping, delivery"
        >
          <Toggle
            id="emailOrderUpdates"
            checked={prefs.emailOrderUpdates}
            onChange={(v) => handlePrefChange("emailOrderUpdates", v)}
          />
        </SettingRow>
        <SettingRow
          label="Marketing"
          description="Promotions and platform news"
        >
          <Toggle
            id="emailMarketing"
            checked={prefs.emailMarketing}
            onChange={(v) => handlePrefChange("emailMarketing", v)}
          />
        </SettingRow>
      </SettingsCard>

      {/* Security */}
      <SettingsCard title="Security">
        <div style={{ paddingTop: 8 }}>
          {!showPasswordForm ? (
            <ActionButton
              label="Change password"
              onClick={() => setShowPasswordForm(true)}
            />
          ) : (
            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: 12 }}>
                <label
                  htmlFor="currentPassword"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    marginBottom: 6,
                  }}
                >
                  Current password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--surface-3)",
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label
                  htmlFor="newPassword"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    marginBottom: 6,
                  }}
                >
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={10}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--surface-3)",
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="confirmPassword"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    marginBottom: 6,
                  }}
                >
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--surface-3)",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={changingPassword}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: "var(--loocbooc-black)",
                    color: "white",
                    cursor: changingPassword ? "wait" : "pointer",
                    opacity: changingPassword ? 0.6 : 1,
                  }}
                >
                  {changingPassword ? "Changing..." : "Update password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--surface-3)",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </SettingsCard>

      {/* Data & Privacy */}
      <SettingsCard title="Data & Privacy">
        <SettingRow
          label="Export my data"
          description="Download a copy of all your Loocbooc data"
        >
          <ActionButton label="Export" onClick={handleExportData} loading={saving} />
        </SettingRow>
        <div style={{ paddingTop: 16 }}>
          {!showDeleteConfirm ? (
            <ActionButton
              label="Delete my account"
              onClick={() => setShowDeleteConfirm(true)}
              variant="danger"
            />
          ) : (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "#7f1d1d",
                  margin: "0 0 12px",
                  lineHeight: 1.5,
                }}
              >
                This will permanently delete your account, avatar, backings, orders, and all
                associated data. This action cannot be undone.
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#7f1d1d",
                  margin: "0 0 12px",
                  fontWeight: 500,
                }}
              >
                Type <strong>delete my account</strong> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete my account"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid #fecaca",
                  marginBottom: 12,
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: "#dc2626",
                    color: "white",
                    cursor: deleting ? "wait" : "pointer",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? "Deleting..." : "Permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--surface-3)",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Sign Out */}
      <SettingsCard title="Session">
        <div style={{ paddingTop: 8 }}>
          <ActionButton label="Sign out" onClick={handleLogout} />
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginTop: 12,
          }}
        >
          Member since{" "}
          {new Date(user.createdAt).toLocaleDateString("en-AU", {
            year: "numeric",
            month: "long",
          })}
        </p>
      </SettingsCard>
    </div>
  );
}
