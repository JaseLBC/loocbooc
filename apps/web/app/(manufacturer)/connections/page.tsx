/**
 * Manufacturer Connections Page.
 *
 * Shows all incoming brand connections, grouped by status:
 *   - Pending enquiries (ENQUIRY) — require a response
 *   - Active connections (CONNECTED)
 *   - Declined (DECLINED)
 *   - Inactive (INACTIVE)
 *
 * For pending enquiries: manufacturer can accept or decline with a response.
 * For active connections: shows connection date, brand info.
 *
 * Design: action-forward. Pending enquiries are prominent.
 * The workflow — read enquiry, decide, respond — should take under 30 seconds.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Connection {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  brandCountry: string | null;
  status: string;
  enquiryMessage: string | null;
  respondedAt: string | null;
  connectedAt: string | null;
  createdAt: string;
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
// Brand avatar
// ─────────────────────────────────────────────

function BrandAvatar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0 text-sm font-semibold text-[var(--text-secondary)] overflow-hidden">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Respond modal
// ─────────────────────────────────────────────

function RespondModal({
  connection,
  onClose,
  onSubmit,
}: {
  connection: Connection;
  onClose: () => void;
  onSubmit: (accept: boolean, message?: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState<"accept" | "decline" | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(decision === "accept", message || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-8 max-w-lg w-full shadow-[var(--shadow-4)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header */}
        <h3 className="font-semibold text-xl text-[var(--text-primary)] mb-1">
          Respond to {connection.brandName}
        </h3>
        <p className="text-sm text-[var(--text-tertiary)] mb-5">
          Received {formatRelative(connection.createdAt)}
        </p>

        {/* Original enquiry */}
        <div className="bg-[var(--surface-2)] rounded-[var(--radius-lg)] p-4 mb-6">
          <div className="flex items-start gap-3">
            <BrandAvatar name={connection.brandName} logoUrl={connection.brandLogoUrl} />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                {connection.brandName}
              </p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {connection.enquiryMessage ?? "No message provided."}
              </p>
            </div>
          </div>
        </div>

        {/* Decision buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setDecision("accept")}
            className={`py-3 rounded-[var(--radius-md)] text-sm font-medium border transition-all ${
              decision === "accept"
                ? "bg-[#22C55E] text-white border-[#22C55E]"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--surface-3)] hover:border-[#22C55E] hover:text-[#22C55E]"
            }`}
          >
            ✓ Accept connection
          </button>
          <button
            type="button"
            onClick={() => setDecision("decline")}
            className={`py-3 rounded-[var(--radius-md)] text-sm font-medium border transition-all ${
              decision === "decline"
                ? "bg-red-50 text-red-600 border-red-400"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--surface-3)] hover:border-red-400 hover:text-red-600"
            }`}
          >
            ✕ Decline
          </button>
        </div>

        {/* Optional response message */}
        {decision && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              {decision === "accept" ? "Message (optional)" : "Reason (optional)"}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={
                decision === "accept"
                  ? "Thanks for reaching out! We'd love to discuss your project in more detail…"
                  : "Thanks for your enquiry. Unfortunately we're not taking new brands at the moment…"
              }
              className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)] resize-none"
            />
          </div>
        )}

        {error && (
          <p className="mb-4 text-sm text-[var(--color-error)]">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-[var(--surface-3)] text-sm text-[var(--text-secondary)] rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!decision || submitting}
            className={`flex-1 py-3 text-sm font-medium rounded-[var(--radius-md)] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              decision === "accept"
                ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] hover:opacity-90"
                : decision === "decline"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[var(--surface-2)] text-[var(--text-tertiary)]"
            }`}
          >
            {submitting ? "Sending…" : decision === "accept" ? "Confirm connection" : "Confirm decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Connection card (pending)
// ─────────────────────────────────────────────

function PendingCard({
  connection,
  onRespond,
}: {
  connection: Connection;
  onRespond: (connection: Connection) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const msgIsLong = (connection.enquiryMessage ?? "").length > 200;

  return (
    <div className="bg-[var(--surface-1)] border border-amber-200 rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-1)]">
      <div className="flex items-start gap-4">
        <BrandAvatar name={connection.brandName} logoUrl={connection.brandLogoUrl} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{connection.brandName}</p>
              {connection.brandCountry && (
                <p className="text-xs text-[var(--text-tertiary)]">{connection.brandCountry}</p>
              )}
            </div>
            <span className="shrink-0 text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-medium border border-amber-200">
              ⏳ Awaiting response
            </span>
          </div>

          {/* Enquiry message */}
          {connection.enquiryMessage && (
            <div className="mt-3">
              <p
                className={`text-sm text-[var(--text-secondary)] leading-relaxed ${
                  !expanded && msgIsLong ? "line-clamp-3" : ""
                }`}
              >
                {connection.enquiryMessage}
              </p>
              {msgIsLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-1 transition-colors"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mt-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              Received {formatRelative(connection.createdAt)}
            </p>
            <button
              type="button"
              onClick={() => onRespond(connection)}
              className="px-4 py-2 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Respond
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Connection card (connected/declined/inactive)
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  CONNECTED: {
    label: "Connected",
    class: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
  },
  DECLINED: {
    label: "Declined",
    class: "bg-red-50 text-red-600 border-red-200",
  },
  INACTIVE: {
    label: "Inactive",
    class: "bg-[var(--surface-2)] text-[var(--text-tertiary)] border-[var(--surface-3)]",
  },
};

function ConnectionCard({ connection }: { connection: Connection }) {
  const cfg = STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.INACTIVE;

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-4 shadow-[var(--shadow-1)] flex items-center gap-4">
      <BrandAvatar name={connection.brandName} logoUrl={connection.brandLogoUrl} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-[var(--text-primary)] text-sm">{connection.brandName}</p>
          {connection.brandCountry && (
            <span className="text-xs text-[var(--text-tertiary)]">· {connection.brandCountry}</span>
          )}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
          {connection.status === "CONNECTED" && connection.connectedAt
            ? `Connected ${formatDate(connection.connectedAt)}`
            : `Enquiry received ${formatDate(connection.createdAt)}`}
        </p>
      </div>

      <span
        className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.class}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-[var(--text-tertiary)] text-sm">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  accent,
}: {
  title: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          accent && count > 0
            ? "bg-amber-100 text-amber-700 border border-amber-200"
            : "bg-[var(--surface-2)] text-[var(--text-secondary)]"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ManufacturerConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<Connection | null>(null);
  const [respondSuccess, setRespondSuccess] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/v1/manufacturers/my-enquiries", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { data?: Connection[] };
      setConnections(data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const handleRespond = async (accept: boolean, message?: string) => {
    if (!activeModal) return;
    const token = getToken();

    const res = await fetch(`/api/v1/manufacturers/connections/${activeModal.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accept, message }),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "Failed to respond");
    }

    const brandName = activeModal.brandName;
    setActiveModal(null);
    setRespondSuccess(
      accept
        ? `You're now connected with ${brandName}.`
        : `You declined ${brandName}'s enquiry.`,
    );
    setTimeout(() => setRespondSuccess(null), 4000);

    // Refresh list
    await fetchConnections();
  };

  // Group by status
  const pending = connections.filter((c) => c.status === "ENQUIRY");
  const connected = connections.filter((c) => c.status === "CONNECTED");
  const declined = connections.filter((c) => c.status === "DECLINED" || c.status === "INACTIVE");

  if (loading) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="h-8 bg-[var(--surface-2)] rounded w-48 mb-8 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-[var(--surface-2)] rounded-[var(--radius-xl)] mb-4 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">
          Connections
        </h1>
        <p className="text-[var(--text-secondary)]">
          Brands who've reached out to work with you.
        </p>
      </header>

      {/* Success banner */}
      {respondSuccess && (
        <div className="mb-6 px-4 py-3 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-[var(--radius-lg)] text-sm text-[#22C55E] font-medium">
          ✓ {respondSuccess}
        </div>
      )}

      {/* No connections at all */}
      {connections.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📬</p>
          <h2 className="font-semibold text-[var(--text-primary)] text-lg mb-2">
            No connections yet
          </h2>
          <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto mb-6">
            Brands find you through search and matching. A complete profile with good photos
            dramatically increases your enquiry rate.
          </p>
          <Link
            href="/manufacturer/profile"
            className="inline-block px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Complete your profile
          </Link>
        </div>
      )}

      {/* Pending enquiries */}
      {(pending.length > 0 || connections.length > 0) && (
        <section className="mb-10">
          <SectionHeader title="Pending enquiries" count={pending.length} accent />
          {pending.length === 0 ? (
            <EmptyState message="No pending enquiries. You're all caught up." />
          ) : (
            <div className="space-y-4">
              {pending.map((c) => (
                <PendingCard
                  key={c.id}
                  connection={c}
                  onRespond={(conn) => setActiveModal(conn)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Active connections */}
      {(connected.length > 0 || connections.length > 0) && (
        <section className="mb-10">
          <SectionHeader title="Connected brands" count={connected.length} />
          {connected.length === 0 ? (
            <EmptyState message="No active connections yet." />
          ) : (
            <div className="space-y-3">
              {connected.map((c) => (
                <ConnectionCard key={c.id} connection={c} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Declined/inactive */}
      {declined.length > 0 && (
        <section>
          <SectionHeader title="Declined & inactive" count={declined.length} />
          <div className="space-y-3">
            {declined.map((c) => (
              <ConnectionCard key={c.id} connection={c} />
            ))}
          </div>
        </section>
      )}

      {/* Respond modal */}
      {activeModal && (
        <RespondModal
          connection={activeModal}
          onClose={() => setActiveModal(null)}
          onSubmit={handleRespond}
        />
      )}
    </div>
  );
}
