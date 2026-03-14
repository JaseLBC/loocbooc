/**
 * Backing Success Page — /back/:campaignId/success
 *
 * Landing page after Stripe redirects back from payment confirmation.
 *
 * URL contains:
 *   ?payment_intent=pi_xxx
 *   &payment_intent_client_secret=pi_xxx_secret_yyy
 *   &redirect_status=succeeded|failed|canceled
 *
 * On mount:
 * 1. Reads payment_intent from URL
 * 2. Calls POST /api/back-it/campaigns/:id/confirm-backing to record in DB
 * 3. Shows success UI with campaign + backing details
 *
 * Idempotent: page refresh does NOT double-count (service handles it).
 * Gracefully handles: failed payments, missing params, network errors.
 *
 * Design: celebratory but calm — the user backed something real.
 * Big green check. Campaign title. What happens next.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface BackingConfirmation {
  id: string;
  size: string;
  quantity: number;
  totalCents: number;
  depositCents: number;
  currency: string;
  depositStatus: string;
  status: string;
  createdAt: string;
}

interface CampaignSummary {
  id: string;
  title: string;
  coverImageUrl: string | null;
  moq: number;
  currentBackingCount: number;
  moqReached: boolean;
  estimatedShipDate: string | null;
  currency: string;
}

type ConfirmState =
  | "loading"
  | "success"
  | "already_confirmed"
  | "payment_failed"
  | "error";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "TBC";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────
// Loading state
// ─────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[var(--loocbooc-black)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-secondary)] text-sm">Confirming your backing…</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Payment failed state
// ─────────────────────────────────────────────

function PaymentFailedState({
  campaignId,
  message,
}: {
  campaignId: string;
  message: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">❌</span>
        </div>
        <h1 className="font-display text-2xl text-[var(--text-primary)] mb-2">
          Payment didn&apos;t go through
        </h1>
        <p className="text-[var(--text-secondary)] mb-2">{message}</p>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          No charge was made. Please try again with a different card.
        </p>
        <Link
          href={`/back/${campaignId}`}
          className="inline-block px-8 py-3.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] font-semibold hover:opacity-90 transition-opacity"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────

function ErrorState({ message, campaignId }: { message: string; campaignId: string }) {
  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-5xl mb-6">⚠️</p>
        <h1 className="font-display text-2xl text-[var(--text-primary)] mb-3">
          Something went wrong
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
          {message}
          <br />
          If you believe your payment went through, please contact support with your reference.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href={`/back/${campaignId}`}
            className="px-6 py-3 border border-[var(--surface-3)] rounded-[var(--radius-md)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Back to campaign
          </Link>
          <a
            href="mailto:support@loocbooc.com"
            className="px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Success state
// ─────────────────────────────────────────────

function SuccessState({
  backing,
  campaign,
  moqJustReached,
}: {
  backing: BackingConfirmation;
  campaign: CampaignSummary | null;
  moqJustReached: boolean;
}) {
  const progressPct = campaign
    ? Math.min(100, Math.round((campaign.currentBackingCount / campaign.moq) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">

        {/* Success card */}
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-3)] overflow-hidden">

          {/* Header */}
          <div className="bg-[var(--loocbooc-black)] px-8 pt-10 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#22C55E] flex items-center justify-center mx-auto mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 16L13 23L26 10"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="font-display text-3xl text-[var(--loocbooc-white)] mb-2">
              You&apos;re in!
            </h1>
            {moqJustReached ? (
              <p className="text-[#22C55E] font-semibold animate-pulse">
                🎉 Your backing just hit the goal!
              </p>
            ) : (
              <p className="text-white/70 text-sm">
                Your backing is confirmed.
              </p>
            )}
          </div>

          {/* Backing summary */}
          <div className="px-8 py-6 border-b border-[var(--surface-3)]">
            {campaign && (
              <h2 className="font-semibold text-[var(--text-primary)] text-lg mb-1">
                {campaign.title}
              </h2>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-3">
              <div>
                <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Size</p>
                <p className="font-semibold text-[var(--text-primary)]">{backing.size}</p>
              </div>
              <div>
                <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Qty</p>
                <p className="font-semibold text-[var(--text-primary)]">{backing.quantity}</p>
              </div>
              <div>
                <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Charged</p>
                <p className="font-semibold text-[var(--text-primary)]">
                  {backing.currency} {(backing.depositCents / 100).toFixed(2)}
                </p>
              </div>
              {campaign?.estimatedShipDate && (
                <div>
                  <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Est. ship</p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {formatDate(campaign.estimatedShipDate)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Campaign progress */}
          {campaign && (
            <div className="px-8 py-5 border-b border-[var(--surface-3)]">
              <div className="flex items-center justify-between text-sm mb-2.5">
                <span className="text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">
                    {campaign.currentBackingCount.toLocaleString()}
                  </strong>
                  {" "}/ {campaign.moq.toLocaleString()} backers
                </span>
                <span className={`font-semibold ${progressPct >= 100 ? "text-[#22C55E]" : "text-[var(--text-primary)]"}`}>
                  {progressPct}%
                </span>
              </div>
              <div className="h-2.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: progressPct >= 100 ? "#22C55E" : "#6366f1",
                  }}
                />
              </div>
              {campaign.moqReached ? (
                <p className="text-xs text-[#22C55E] mt-2 font-medium">
                  🎉 Goal reached — this campaign is going to production!
                </p>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] mt-2">
                  {Math.max(0, campaign.moq - campaign.currentBackingCount).toLocaleString()} more backers needed to hit the goal.
                </p>
              )}
            </div>
          )}

          {/* What happens next */}
          <div className="px-8 py-6">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
              What happens next
            </p>
            <div className="space-y-4">
              {[
                {
                  icon: "📧",
                  title: "Confirmation email",
                  desc: "A confirmation of your backing is on its way to your inbox.",
                },
                {
                  icon: "🎯",
                  title: "Reaching the goal",
                  desc: `Once ${campaign?.moq.toLocaleString() ?? "the"} backers confirm, the brand starts production.`,
                },
                {
                  icon: "💳",
                  title: "If the campaign succeeds",
                  desc: "Your payment is captured and your item goes into production.",
                },
                {
                  icon: "🔄",
                  title: "If the campaign doesn't reach its goal",
                  desc: "You get a full, automatic refund. No questions, no hassle.",
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-8 pb-8 flex flex-col gap-3">
            {campaign && (
              <Link
                href={`/back/${campaign.id}`}
                className="block w-full py-3 text-center text-sm font-medium border border-[var(--surface-3)] rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                View campaign
              </Link>
            )}
          </div>
        </div>

        {/* Reference */}
        <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
          Backing ID: <span className="font-mono">{backing.id.slice(-8).toUpperCase()}</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function BackingSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params?.campaignId as string;

  const paymentIntent = searchParams?.get("payment_intent");
  const redirectStatus = searchParams?.get("redirect_status");

  const [confirmState, setConfirmState] = useState<ConfirmState>("loading");
  const [backing, setBacking] = useState<BackingConfirmation | null>(null);
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [moqJustReached, setMoqJustReached] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("An unexpected error occurred.");

  useEffect(() => {
    if (!campaignId) {
      setErrorMessage("Campaign not found.");
      setConfirmState("error");
      return;
    }

    // Check Stripe's reported redirect status before calling our backend
    if (redirectStatus === "failed" || redirectStatus === "canceled") {
      setErrorMessage(
        redirectStatus === "canceled"
          ? "Payment was cancelled."
          : "Your payment was declined. Please try again with a different card.",
      );
      setConfirmState("payment_failed");
      return;
    }

    if (!paymentIntent) {
      setErrorMessage("No payment reference found. If you believe your payment went through, contact support.");
      setConfirmState("error");
      return;
    }

    // Fetch campaign details in parallel with confirming the backing
    const confirmAndFetch = async () => {
      try {
        const [confirmRes, campaignRes] = await Promise.all([
          fetch(`/api/back-it/campaigns/${campaignId}/confirm-backing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: paymentIntent }),
          }),
          fetch(`/api/v1/back-it/campaigns/${campaignId}`),
        ]);

        const confirmJson = await confirmRes.json() as {
          data?: {
            backing: BackingConfirmation;
            moqJustReached: boolean;
            alreadyConfirmed: boolean;
          };
          error?: { message: string; code: string };
        };

        if (!confirmRes.ok) {
          // Handle specific error cases
          const code = confirmJson.error?.code;
          if (code === "PAYMENT_NOT_SUCCEEDED") {
            setErrorMessage("Your payment has not yet been confirmed by Stripe. Please wait a moment and refresh.");
            setConfirmState("payment_failed");
            return;
          }
          throw new Error(confirmJson.error?.message ?? "Failed to confirm backing.");
        }

        if (!confirmJson.data) {
          throw new Error("Invalid response from server.");
        }

        setBacking(confirmJson.data.backing);
        setMoqJustReached(confirmJson.data.moqJustReached);
        setConfirmState(
          confirmJson.data.alreadyConfirmed ? "already_confirmed" : "success",
        );

        // Load campaign details (non-fatal if it fails)
        if (campaignRes.ok) {
          const campaignJson = await campaignRes.json() as { data?: CampaignSummary };
          if (campaignJson.data) setCampaign(campaignJson.data);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
        setConfirmState("error");
      }
    };

    void confirmAndFetch();
  }, [campaignId, paymentIntent, redirectStatus]);

  if (confirmState === "loading") {
    return <LoadingState />;
  }

  if (confirmState === "payment_failed") {
    return <PaymentFailedState campaignId={campaignId} message={errorMessage} />;
  }

  if (confirmState === "error") {
    return <ErrorState message={errorMessage} campaignId={campaignId} />;
  }

  if ((confirmState === "success" || confirmState === "already_confirmed") && backing) {
    return (
      <SuccessState
        backing={backing}
        campaign={campaign}
        moqJustReached={moqJustReached && confirmState === "success"}
      />
    );
  }

  return <LoadingState />;
}
