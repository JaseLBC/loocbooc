/**
 * Brand Connections Page — /manufacturers/connections
 *
 * Shows all manufacturer connections for this brand, grouped by status:
 *   - Connected (CONNECTED) — active working relationships
 *   - Pending (ENQUIRY) — awaiting manufacturer response
 *   - Declined (DECLINED) — manufacturer declined or went inactive
 *
 * For each connected manufacturer: shows summary card + link to profile.
 * For pending: shows when enquiry was sent.
 * CTA: "Find more manufacturers" → back to discovery.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AggregatedRatings {
  overall: number;
  totalReviews: number;
  quality: number;
  communication: number;
  timeliness: number;
}

interface ManufacturerSummary {
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
  priceTier: string;
  isVerified: boolean;
  ratings: AggregatedRatings;
}

interface ConnectionResult {
  id: string;
  brandId: string;
  manufacturerProfileId: string;
  status: string;
  enquiryMessage: string | null;
  respondedAt: string | null;
  connectedAt: string | null;
  createdAt: string;
  manufacturerProfile?: ManufacturerSummary;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(iso);
  if (days === 1) return "Yesterday";
  if (days > 1) return `${days} days ago`;
  if (hours === 1) return "1 hour ago";
  if (hours > 1) return `${hours} hours ago`;
  if (minutes < 2) return "Just now";
  return `${minutes} minutes ago`;
}

// ─────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  CONNECTED: {
    label: "Connected",
    class: "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20",
  },
  ENQUIRY: {
    label: "Pending",
    class: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  DECLINED: {
    label: "Declined",
    class: "bg-red-50 text-red-600 border border-red-100",
  },
  RESPONDED: {
    label: "Responded",
    class: "bg-blue-50 text-blue-600 border border-blue-100",
  },
  INACTIVE: {
    label: "Inactive",
    class: "bg-[var(--surface-2)] text-[var(--text-tertiary)] border border-[var(--surface-3)]",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGES[status] ?? STATUS_BADGES.INACTIVE;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#22C55E]">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M5 0L6.18 3.28L9.51 3.09L7.09 5.17L7.94 8.41L5 6.8L2.06 8.41L2.91 5.17L0.49 3.09L3.82 3.28L5 0Z" />
      </svg>
      Verified
    </span>
  );
}

// ─────────────────────────────────────────────
// Connected manufacturer card
// ─────────────────────────────────────────────

function ConnectedManufacturerCard({
  connection,
}: {
  connection: ConnectionResult & { manufacturerProfile: ManufacturerSummary };
}) {
  const { manufacturerProfile: m, connectedAt, createdAt, status } = connection;
  const location = [m.city, m.country].filter(Boolean).join(", ");

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] overflow-hidden flex gap-0">
      {/* Image strip */}
      <div className="relative w-36 shrink-0 bg-[var(--surface-2)]">
        {m.heroImageUrl ? (
          <Image
            src={m.heroImageUrl}
            alt={m.displayName}
            fill
            className="object-cover"
            sizes="144px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🏭</div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="font-semibold text-[var(--text-primary)]">{m.displayName}</h3>
              {m.isVerified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{location}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm mb-4">
          <span className="text-[var(--text-tertiary)]">
            MOQ: <span className="text-[var(--text-primary)] font-medium">{m.moqMin.toLocaleString()}+</span>
          </span>
          <span className="text-[var(--text-tertiary)]">
            Sample: <span className="text-[var(--text-primary)] font-medium">{m.sampleLeadTimeDays}d</span>
          </span>
          <span className="text-[var(--text-tertiary)]">
            Bulk: <span className="text-[var(--text-primary)] font-medium">{m.bulkLeadTimeDays}d</span>
          </span>
          {m.ratings.totalReviews > 0 && (
            <span className="text-[var(--text-tertiary)]">
              Rating: <span className="text-[var(--text-primary)] font-medium">
                {m.ratings.overall.toFixed(1)}/5
              </span>
              <span className="text-[var(--text-tertiary)]"> ({m.ratings.totalReviews})</span>
            </span>
          )}
        </div>

        {/* Specialisations */}
        {m.specialisations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {m.specialisations.slice(0, 3).map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text-secondary)] text-xs rounded-full"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-[var(--surface-3)]">
          <p className="text-xs text-[var(--text-tertiary)]">
            {status === "CONNECTED" && connectedAt
              ? `Connected ${formatDate(connectedAt)}`
              : `Enquiry sent ${formatRelative(createdAt)}`}
          </p>
          <Link
            href={`/manufacturers/${m.id}`}
            className="px-4 py-1.5 text-sm text-[var(--text-primary)] border border-[var(--surface-3)] rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          >
            View profile →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Minimal card (no profile loaded)
// ─────────────────────────────────────────────

function MinimalConnectionCard({ connection }: { connection: ConnectionResult }) {
  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)]">
          🏭
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Manufacturer #{connection.manufacturerProfileId.slice(-6)}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {formatRelative(connection.createdAt)}
          </p>
        </div>
      </div>
      <StatusBadge status={connection.status} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────

function StatsBar({
  total,
  connected,
  pending,
}: {
  total: number;
  connected: number;
  pending: number;
}) {
  return (
    <div className="flex gap-6 py-4 border-b border-[var(--surface-3)] mb-8">
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{total}</p>
        <p className="text-xs text-[var(--text-tertiary)]">Total connections</p>
      </div>
      <div className="w-px bg-[var(--surface-3)]" />
      <div>
        <p className="text-2xl font-bold text-[#22C55E]">{connected}</p>
        <p className="text-xs text-[var(--text-tertiary)]">Active</p>
      </div>
      <div className="w-px bg-[var(--surface-3)]" />
      <div>
        <p className="text-2xl font-bold text-amber-500">{pending}</p>
        <p className="text-xs text-[var(--text-tertiary)]">Pending response</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
      <span className="text-xs px-2 py-0.5 bg-[var(--surface-2)] text-[var(--text-secondary)] rounded-full">
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function BrandConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Sign in to view your connections.");
      setLoading(false);
      return;
    }

    fetch("/api/v1/manufacturers/connections", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load connections");
        return r.json() as Promise<{ data: ConnectionResult[] }>;
      })
      .then((data) => {
        setConnections(data.data ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const connected = connections.filter((c) => c.status === "CONNECTED");
  const pending = connections.filter((c) => c.status === "ENQUIRY" || c.status === "RESPONDED");
  const declined = connections.filter((c) => c.status === "DECLINED" || c.status === "INACTIVE");

  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="h-8 bg-[var(--surface-2)] rounded w-56 mb-8 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 bg-[var(--surface-2)] rounded-[var(--radius-xl)] mb-4 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="p-6 bg-red-50 border border-red-100 rounded-[var(--radius-xl)] text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/manufacturers"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            ← Find manufacturers
          </Link>
        </div>
        <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
          Your connections
        </h1>
        <p className="text-[var(--text-secondary)]">
          Manufacturers you've reached out to via Loocbooc.
        </p>
      </header>

      {connections.length > 0 && (
        <StatsBar
          total={connections.length}
          connected={connected.length}
          pending={pending.length}
        />
      )}

      {/* Empty state */}
      {connections.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🤝</p>
          <h2 className="font-semibold text-[var(--text-primary)] text-lg mb-2">
            No connections yet
          </h2>
          <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto mb-6">
            Browse the manufacturer marketplace and send your first enquiry to start building
            production relationships.
          </p>
          <Link
            href="/manufacturers"
            className="inline-block px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Find manufacturers
          </Link>
        </div>
      )}

      {/* Active connections */}
      {connected.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="Active connections" count={connected.length} />
          <div className="space-y-4">
            {connected.map((c) =>
              c.manufacturerProfile ? (
                <ConnectedManufacturerCard
                  key={c.id}
                  connection={c as ConnectionResult & { manufacturerProfile: ManufacturerSummary }}
                />
              ) : (
                <MinimalConnectionCard key={c.id} connection={c} />
              ),
            )}
          </div>
        </section>
      )}

      {/* Pending enquiries */}
      {pending.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="Awaiting response" count={pending.length} />
          <div className="space-y-4">
            {pending.map((c) =>
              c.manufacturerProfile ? (
                <ConnectedManufacturerCard
                  key={c.id}
                  connection={c as ConnectionResult & { manufacturerProfile: ManufacturerSummary }}
                />
              ) : (
                <MinimalConnectionCard key={c.id} connection={c} />
              ),
            )}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-3">
            Manufacturers typically respond within 24–48 hours.
          </p>
        </section>
      )}

      {/* Declined */}
      {declined.length > 0 && (
        <section>
          <SectionHeader title="Declined & inactive" count={declined.length} />
          <div className="space-y-3">
            {declined.map((c) =>
              c.manufacturerProfile ? (
                <ConnectedManufacturerCard
                  key={c.id}
                  connection={c as ConnectionResult & { manufacturerProfile: ManufacturerSummary }}
                />
              ) : (
                <MinimalConnectionCard key={c.id} connection={c} />
              ),
            )}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      {connections.length > 0 && (
        <div className="mt-12 p-6 bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-[var(--text-primary)] mb-0.5">
              Looking for more manufacturers?
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Browse the full marketplace or use AI matching to find the best fit for your brand.
            </p>
          </div>
          <Link
            href="/manufacturers"
            className="shrink-0 px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Browse manufacturers
          </Link>
        </div>
      )}
    </div>
  );
}
