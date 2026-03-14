/**
 * Manufacturer Dashboard — overview page.
 *
 * Shows:
 *  - Profile completeness score + what's missing
 *  - Enquiry/connection summary cards
 *  - Recent activity feed
 *  - Quick links to profile edit and connections
 *
 * Design: clean, data-forward. The manufacturer should know exactly
 * what state their account is in before clicking anything.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ProfileSummary {
  id: string;
  displayName: string;
  heroImageUrl: string | null;
  country: string;
  city: string | null;
  moqMin: number;
  moqMax: number | null;
  sampleLeadTimeDays: number;
  bulkLeadTimeDays: number;
  specialisations: string[];
  certifications: string[];
  priceTier: string;
  isVerified: boolean;
  description: string | null;
  galleryImageUrls: string[];
  monthlyCapacityMin: number | null;
  monthlyCapacityMax: number | null;
  materials: string[];
  exportMarkets: string[];
  languages: string[];
  ratings: {
    overall: number;
    totalReviews: number;
  };
}

interface Connection {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  status: string;
  enquiryMessage: string | null;
  createdAt: string;
  connectedAt: string | null;
}

// ─────────────────────────────────────────────
// Profile completeness scorer
// ─────────────────────────────────────────────

interface CompletenessItem {
  label: string;
  done: boolean;
  href: string;
}

function computeCompleteness(profile: ProfileSummary | null): {
  score: number;
  items: CompletenessItem[];
} {
  if (!profile) {
    return {
      score: 0,
      items: [
        { label: "Set up your profile", done: false, href: "/manufacturer/profile" },
      ],
    };
  }

  const items: CompletenessItem[] = [
    {
      label: "Add a description",
      done: Boolean(profile.description && profile.description.length > 50),
      href: "/manufacturer/profile",
    },
    {
      label: "Upload a hero image",
      done: Boolean(profile.heroImageUrl),
      href: "/manufacturer/profile",
    },
    {
      label: "Add gallery photos (3+)",
      done: profile.galleryImageUrls.length >= 3,
      href: "/manufacturer/profile",
    },
    {
      label: "Set MOQ range",
      done: profile.moqMin > 0 || Boolean(profile.moqMax),
      href: "/manufacturer/profile",
    },
    {
      label: "Add specialisations (2+)",
      done: profile.specialisations.length >= 2,
      href: "/manufacturer/profile",
    },
    {
      label: "Add certifications",
      done: profile.certifications.length > 0,
      href: "/manufacturer/profile",
    },
    {
      label: "List materials you work with",
      done: profile.materials.length > 0,
      href: "/manufacturer/profile",
    },
    {
      label: "Add export markets",
      done: profile.exportMarkets.length > 0,
      href: "/manufacturer/profile",
    },
    {
      label: "Set monthly capacity",
      done: Boolean(profile.monthlyCapacityMin),
      href: "/manufacturer/profile",
    },
    {
      label: "List languages spoken",
      done: profile.languages.length > 0,
      href: "/manufacturer/profile",
    },
  ];

  const done = items.filter((i) => i.done).length;
  const score = Math.round((done / items.length) * 100);
  return { score, items };
}

// ─────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-[var(--radius-xl)] ${accent ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)]" : "bg-[var(--surface-1)] shadow-[var(--shadow-1)]"}`}
    >
      <p
        className={`text-xs font-medium mb-1 ${accent ? "text-white/60" : "text-[var(--text-tertiary)]"}`}
      >
        {label}
      </p>
      <p
        className={`font-display text-3xl font-bold leading-none mb-1 ${accent ? "text-[var(--loocbooc-white)]" : "text-[var(--text-primary)]"}`}
      >
        {value}
      </p>
      {subtext && (
        <p className={`text-xs ${accent ? "text-white/50" : "text-[var(--text-tertiary)]"}`}>
          {subtext}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Completeness bar
// ─────────────────────────────────────────────

function CompletenessCard({
  score,
  items,
}: {
  score: number;
  items: CompletenessItem[];
}) {
  const missing = items.filter((i) => !i.done);

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-1)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[var(--text-primary)]">Profile completeness</h3>
        <span
          className={`font-bold text-lg ${score === 100 ? "text-[#22C55E]" : score >= 70 ? "text-amber-500" : "text-[var(--color-error)]"}`}
        >
          {score}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-[var(--duration-slow)] ${
            score === 100 ? "bg-[#22C55E]" : score >= 70 ? "bg-amber-400" : "bg-[var(--loocbooc-accent)]"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>

      {score === 100 ? (
        <p className="text-sm text-[#22C55E] font-medium">
          ✓ Your profile is complete. Brands can see everything they need to connect with you.
        </p>
      ) : (
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">
            {missing.length} thing{missing.length !== 1 ? "s" : ""} left to complete:
          </p>
          <ul className="space-y-1.5">
            {missing.slice(0, 4).map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="w-4 h-4 rounded-full border border-[var(--surface-3)] inline-block shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}
            {missing.length > 4 && (
              <li className="text-xs text-[var(--text-tertiary)]">
                + {missing.length - 4} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Recent connection row
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  ENQUIRY: {
    label: "Pending",
    class: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  CONNECTED: {
    label: "Connected",
    class: "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20",
  },
  DECLINED: {
    label: "Declined",
    class: "bg-red-50 text-red-600 border border-red-200",
  },
  RESPONDED: {
    label: "Responded",
    class: "bg-blue-50 text-blue-600 border border-blue-200",
  },
  INACTIVE: {
    label: "Inactive",
    class: "bg-[var(--surface-2)] text-[var(--text-tertiary)]",
  },
};

function ConnectionRow({ connection }: { connection: Connection }) {
  const cfg = STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.ENQUIRY;
  const date = new Date(connection.createdAt).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href="/manufacturer/connections"
      className="flex items-center gap-4 p-3 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0 text-sm font-semibold text-[var(--text-secondary)]">
        {connection.brandLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={connection.brandLogoUrl}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          connection.brandName.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--loocbooc-accent)] transition-colors">
          {connection.brandName}
        </p>
        {connection.enquiryMessage && (
          <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
            {connection.enquiryMessage}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.class}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">{date}</span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-[var(--surface-2)] rounded animate-pulse ${className ?? ""}`} />
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ManufacturerDashboard() {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("loocbooc_token") : null;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/v1/manufacturers/my-profile", { headers })
        .then((r) => r.json())
        .then((d: { data?: ProfileSummary }) => d.data ?? null)
        .catch(() => null),
      fetch("/api/v1/manufacturers/my-enquiries", { headers })
        .then((r) => r.json())
        .then((d: { data?: Connection[] }) => d.data ?? [])
        .catch(() => [] as Connection[]),
    ]).then(([profileData, connectionsData]) => {
      setProfile(profileData);
      setConnections(connectionsData);
      setLoading(false);
    });
  }, []);

  const { score, items } = computeCompleteness(profile);
  const pendingCount = connections.filter((c) => c.status === "ENQUIRY").length;
  const connectedCount = connections.filter((c) => c.status === "CONNECTED").length;
  const totalCount = connections.length;
  const recentConnections = connections.slice(0, 5);

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <header className="mb-8">
        {loading ? (
          <Skeleton className="h-9 w-64 mb-2" />
        ) : (
          <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
            {profile ? `Welcome back, ${profile.displayName}` : "Manufacturer Dashboard"}
          </h1>
        )}
        <p className="text-[var(--text-secondary)]">
          Manage your profile and connections from here.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <Skeleton className="h-28 rounded-[var(--radius-xl)]" />
            <Skeleton className="h-28 rounded-[var(--radius-xl)]" />
            <Skeleton className="h-28 rounded-[var(--radius-xl)]" />
            <Skeleton className="h-28 rounded-[var(--radius-xl)]" />
          </>
        ) : (
          <>
            <StatCard
              label="Pending enquiries"
              value={pendingCount}
              subtext={pendingCount > 0 ? "Awaiting your response" : "All caught up"}
              accent={pendingCount > 0}
            />
            <StatCard
              label="Active connections"
              value={connectedCount}
              subtext="Connected brands"
            />
            <StatCard
              label="Total connections"
              value={totalCount}
              subtext="All time"
            />
            <StatCard
              label="Profile score"
              value={`${score}%`}
              subtext={score < 100 ? "Incomplete" : "Complete"}
            />
          </>
        )}
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: recent connections */}
        <div className="lg:col-span-3">
          <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-1)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[var(--text-primary)]">Recent connections</h2>
              <Link
                href="/manufacturer/connections"
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-[var(--radius-md)]" />
                ))}
              </div>
            ) : recentConnections.length > 0 ? (
              <div>
                {recentConnections.map((c) => (
                  <ConnectionRow key={c.id} connection={c} />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-3xl mb-3">📬</p>
                <p className="text-[var(--text-secondary)] text-sm font-medium mb-1">
                  No connections yet
                </p>
                <p className="text-[var(--text-tertiary)] text-xs">
                  Complete your profile to attract brands.
                </p>
                <Link
                  href="/manufacturer/profile"
                  className="inline-block mt-4 px-4 py-2 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Complete profile
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: completeness + quick actions */}
        <div className="lg:col-span-2 space-y-4">

          {/* Completeness */}
          {loading ? (
            <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
          ) : (
            <CompletenessCard score={score} items={items} />
          )}

          {/* Quick actions */}
          <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-1)] space-y-2">
            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-3">
              Quick actions
            </h3>
            <Link
              href="/manufacturer/profile"
              className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <span>✎</span> Edit profile
            </Link>
            <Link
              href="/manufacturer/connections"
              className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <span>🤝</span>
              View all connections
              {pendingCount > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                  {pendingCount} pending
                </span>
              )}
            </Link>
            <Link
              href="/manufacturers"
              className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <span>👁</span> Preview your public profile
            </Link>
          </div>

          {/* Verification notice */}
          {!loading && profile && !profile.isVerified && (
            <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-xl)] p-4">
              <p className="text-sm font-medium text-amber-800 mb-1">⏳ Verification pending</p>
              <p className="text-xs text-amber-700">
                Your profile is under review. Verified manufacturers appear higher in search
                results. You'll hear from us within 2 business days.
              </p>
            </div>
          )}

          {!loading && profile?.isVerified && (
            <div className="bg-[#22C55E]/8 border border-[#22C55E]/20 rounded-[var(--radius-xl)] p-4">
              <p className="text-sm font-medium text-[#22C55E] mb-1">✓ Verified manufacturer</p>
              <p className="text-xs text-[#22C55E]/80">
                Your account is verified. You appear prominently in search results and match
                recommendations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
