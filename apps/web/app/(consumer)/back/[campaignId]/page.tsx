/**
 * Back It — consumer campaign page.
 *
 * The page a customer lands on to back a pre-production style.
 *
 * Architecture:
 * - Server component (SSR + ISR, revalidates every 30s) for SEO and fast initial load.
 * - CampaignProgressBar is a Client Component with Supabase Realtime subscription.
 * - BackingForm is a Client Component with Stripe Payment Element.
 *
 * States handled:
 *   active       → full page with backing form
 *   moq_reached  → progress bar + "production started" banner, form hidden
 *   funded       → same as moq_reached
 *   in_production → production status with timeline
 *   shipped      → shipped state
 *   completed    → completed state
 *   expired      → "goal not reached, no charge" state
 *   draft/scheduled → not publicly accessible (404)
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CampaignProgressBar } from "../../../../components/back-it/CampaignProgressBar";
import { BackingForm } from "../../../../components/back-it/BackingForm";
import { StripeProvider } from "../../../../components/back-it/StripeProvider";
import { API_URL } from "../../../../lib/supabase";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "moq_reached"
  | "funded"
  | "in_production"
  | "shipped"
  | "completed"
  | "cancelled"
  | "expired";

interface SizeBreak {
  size: string;
  backingCount: number;
}

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: CampaignStatus;
  coverImageUrl: string | null;
  galleryUrls: string[];
  retailPriceCents: number;
  backerPriceCents: number;
  depositPercent: number;
  currency: string;
  moq: number;
  currentBackingCount: number;
  moqReached: boolean;
  moqReachedAt: string | null;
  stretchGoalQty: number | null;
  campaignStart: string;
  campaignEnd: string;
  estimatedShipDate: string | null;
  availableSizes: string[];
  sizeLimits: Record<string, number> | null;
  sizeBreaks: SizeBreak[];
  manufacturerNotifiedAt: string | null;
}

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const url = `${API_URL}/api/v1/back-it/campaigns/${id}`;
    const res = await fetch(url, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: Campaign };
    return json.data;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// SEO metadata
// ─────────────────────────────────────────────

interface PageProps {
  params: { campaignId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const campaign = await getCampaign(params.campaignId);
  if (!campaign) return { title: "Campaign Not Found | Loocbooc" };

  const savingsPercent = Math.round(
    ((campaign.retailPriceCents - campaign.backerPriceCents) / campaign.retailPriceCents) * 100,
  );

  return {
    title: `${campaign.title} | Back It on Loocbooc`,
    description:
      campaign.description?.slice(0, 160) ??
      `Back this campaign at ${(campaign.backerPriceCents / 100).toFixed(2)} ${campaign.currency} — ${savingsPercent}% off retail. Refund guaranteed if goal isn't reached.`,
    openGraph: {
      title: campaign.title,
      description: campaign.description?.slice(0, 160) ?? "",
      images: campaign.coverImageUrl ? [{ url: campaign.coverImageUrl }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: campaign.title,
      description: campaign.description?.slice(0, 160) ?? "",
      images: campaign.coverImageUrl ? [campaign.coverImageUrl] : [],
    },
  };
}

// ─────────────────────────────────────────────
// Status-specific banners
// ─────────────────────────────────────────────

function MoqReachedBanner({ moqReachedAt }: { moqReachedAt: string | null }) {
  const date = moqReachedAt
    ? new Date(moqReachedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-[var(--radius-xl)] p-6 text-center">
      <p className="text-3xl mb-3">🎉</p>
      <h2 className="font-semibold text-indigo-900 text-lg mb-1">
        This campaign hit its goal!
      </h2>
      {date && (
        <p className="text-indigo-700 text-sm mb-3">Goal reached on {date}</p>
      )}
      <p className="text-sm text-indigo-600 max-w-sm mx-auto">
        The brand has confirmed production. Backers will receive updates as their order moves through production.
      </p>
    </div>
  );
}

function InProductionBanner() {
  return (
    <div className="bg-purple-50 border border-purple-100 rounded-[var(--radius-xl)] p-6 text-center">
      <p className="text-3xl mb-3">🏭</p>
      <h2 className="font-semibold text-purple-900 text-lg mb-1">
        In production
      </h2>
      <p className="text-sm text-purple-600 max-w-sm mx-auto">
        This campaign is currently in production. Backers will be notified when orders are shipped.
      </p>
    </div>
  );
}

function ShippedBanner() {
  return (
    <div className="bg-sky-50 border border-sky-100 rounded-[var(--radius-xl)] p-6 text-center">
      <p className="text-3xl mb-3">📦</p>
      <h2 className="font-semibold text-sky-900 text-lg mb-1">
        Orders shipped!
      </h2>
      <p className="text-sm text-sky-600 max-w-sm mx-auto">
        Orders are on their way to backers. Check your email for tracking details.
      </p>
    </div>
  );
}

function CompletedBanner() {
  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-[var(--radius-xl)] p-6 text-center">
      <p className="text-3xl mb-3">✅</p>
      <h2 className="font-semibold text-emerald-900 text-lg mb-1">
        Campaign completed
      </h2>
      <p className="text-sm text-emerald-600 max-w-sm mx-auto">
        This campaign has been fulfilled. All orders have been delivered to backers.
      </p>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-[var(--radius-xl)] p-6 text-center">
      <p className="text-3xl mb-3">⏱</p>
      <h2 className="font-semibold text-orange-900 text-lg mb-1">
        Campaign ended without reaching its goal
      </h2>
      <p className="text-sm text-orange-600 max-w-sm mx-auto">
        This campaign closed before reaching its minimum order quantity.
        All backers received a full automatic refund. No charges were made.
      </p>
    </div>
  );
}

function CancelledBanner() {
  return (
    <div className="bg-red-50 border border-red-100 rounded-[var(--radius-xl)] p-6 text-center">
      <p className="text-3xl mb-3">🚫</p>
      <h2 className="font-semibold text-red-900 text-lg mb-1">
        Campaign cancelled
      </h2>
      <p className="text-sm text-red-600 max-w-sm mx-auto">
        This campaign was cancelled by the brand. If you were a backer, you received a full refund.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// How Back It works explainer
// ─────────────────────────────────────────────

function HowItWorks({ moq, currency, backerPriceCents, retailPriceCents }: {
  moq: number;
  currency: string;
  backerPriceCents: number;
  retailPriceCents: number;
}) {
  const savingsCents = retailPriceCents - backerPriceCents;
  const savingsPct = Math.round((savingsCents / retailPriceCents) * 100);

  const steps = [
    {
      number: "01",
      title: "You back it",
      description: `You pay ${currency} ${(backerPriceCents / 100).toFixed(2)} — ${savingsPct}% less than the ${currency} ${(retailPriceCents / 100).toFixed(2)} retail price.`,
      icon: "💳",
    },
    {
      number: "02",
      title: `${moq.toLocaleString()} people back it`,
      description: `When ${moq.toLocaleString()} backers commit, the brand confirms production. The goal is the minimum needed to manufacture.`,
      icon: "🎯",
    },
    {
      number: "03",
      title: "It gets made",
      description: "The brand works with their manufacturer to produce your item. You get updates along the way.",
      icon: "🏭",
    },
    {
      number: "04",
      title: "It ships to you",
      description: "Your item arrives. You got something real before it existed — at a better price than anyone else will pay.",
      icon: "📦",
    },
  ];

  return (
    <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-8">
      <h2 className="font-display text-xl text-[var(--text-primary)] mb-2">
        How Back It works
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-8">
        Back It is how fashion gets made. No middlemen. No overproduction. Just real demand driving real production.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {steps.map((step) => (
          <div key={step.number} className="flex gap-4">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--surface-2)] flex items-center justify-center text-lg">
                {step.icon}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] tracking-widest">
                  {step.number}
                </span>
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  {step.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--surface-3)]">
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0 mt-0.5">🔒</span>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-0.5">
              Refund guaranteed if the goal isn&apos;t reached
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              If this campaign doesn&apos;t reach {moq.toLocaleString()} backers before it closes,
              every backer receives a full automatic refund. No action required on your part.
              No questions. No forms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Trust bar
// ─────────────────────────────────────────────

function TrustBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6 border-t border-b border-[var(--surface-3)]">
      {[
        { icon: "🔐", label: "Secure checkout", sub: "256-bit SSL encryption" },
        { icon: "💸", label: "Refund guaranteed", sub: "If goal isn't reached" },
        { icon: "📧", label: "Order updates", sub: "Email at every step" },
        { icon: "🚚", label: "Direct to you", sub: "From manufacturer to door" },
      ].map(({ icon, label, sub }) => (
        <div key={label} className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Gallery
// ─────────────────────────────────────────────

function Gallery({ urls, title }: { urls: string[]; title: string }) {
  if (urls.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-xl text-[var(--text-primary)] mb-5">Gallery</h2>
      <div className={`grid gap-3 ${
        urls.length === 1 ? "grid-cols-1" :
        urls.length === 2 ? "grid-cols-2" :
        urls.length === 3 ? "grid-cols-3" :
        "grid-cols-2 sm:grid-cols-4"
      }`}>
        {urls.map((url, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-2)] ${
              urls.length >= 4 && i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${title} — image ${i + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-[var(--duration-slow)]"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pricing block
// ─────────────────────────────────────────────

function PricingBlock({
  backerPriceCents,
  retailPriceCents,
  currency,
  depositPercent,
}: {
  backerPriceCents: number;
  retailPriceCents: number;
  currency: string;
  depositPercent: number;
}) {
  const savingsCents = retailPriceCents - backerPriceCents;
  const savingsPct = Math.round((savingsCents / retailPriceCents) * 100);
  const depositCents = Math.round(backerPriceCents * (depositPercent / 100));

  return (
    <div className="space-y-3">
      {/* Backer price — the hero number */}
      <div className="flex items-end gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
            Back It price
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl text-[var(--text-primary)] leading-none">
              {currency} {(backerPriceCents / 100).toFixed(2)}
            </span>
            <span className="px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] text-sm font-semibold rounded-full">
              Save {savingsPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Retail price */}
      <p className="text-sm text-[var(--text-secondary)]">
        Retail price after production:{" "}
        <span className="line-through text-[var(--text-tertiary)]">
          {currency} {(retailPriceCents / 100).toFixed(2)}
        </span>
        {" "}
        <span className="text-[var(--text-secondary)]">
          — you save {currency} {(savingsCents / 100).toFixed(2)}
        </span>
      </p>

      {/* Deposit note if < 100% */}
      {depositPercent < 100 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-[var(--radius-md)]">
          <span className="shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-amber-700">
            <strong>Deposit model:</strong> You&apos;re charged {currency} {(depositCents / 100).toFixed(2)} ({depositPercent}%) now.
            The remaining {currency} {((backerPriceCents - depositCents) / 100).toFixed(2)} is only charged if the campaign reaches its goal.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Campaign description
// ─────────────────────────────────────────────

function CampaignDescription({ description }: { description: string }) {
  return (
    <div>
      <h2 className="font-display text-xl text-[var(--text-primary)] mb-4">About this campaign</h2>
      <div className="prose prose-sm max-w-none text-[var(--text-secondary)] leading-relaxed">
        {description.split("\n").filter(Boolean).map((para, i) => (
          <p key={i} className="mb-4 last:mb-0">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Timeline summary (for non-active campaigns)
// ─────────────────────────────────────────────

function TimelineSummary({ campaign }: { campaign: Campaign }) {
  const now = Date.now();

  const milestones = [
    {
      icon: "📣",
      label: "Campaign opened",
      date: campaign.campaignStart,
      done: new Date(campaign.campaignStart).getTime() < now,
    },
    {
      icon: "🏁",
      label: "Campaign closed",
      date: campaign.campaignEnd,
      done: new Date(campaign.campaignEnd).getTime() < now,
    },
    ...(campaign.moqReachedAt
      ? [{
          icon: "🎉",
          label: "Goal reached",
          date: campaign.moqReachedAt,
          done: true,
        }]
      : []),
    ...(campaign.estimatedShipDate
      ? [{
          icon: "📦",
          label: "Estimated shipping",
          date: campaign.estimatedShipDate,
          done: new Date(campaign.estimatedShipDate).getTime() < now,
        }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {milestones.map(({ icon, label, date, done }) => (
        <div key={label} className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
            done ? "bg-[#22C55E]/10" : "bg-[var(--surface-2)]"
          }`}>
            {icon}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${done ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>
              {label}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {new Date(date).toLocaleDateString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          {done && (
            <span className="text-[#22C55E] text-xs font-medium">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sticky sidebar (desktop)
// ─────────────────────────────────────────────

function CampaignSidebar({
  campaign,
  showForm,
}: {
  campaign: Campaign;
  showForm: boolean;
}) {
  return (
    <div className="lg:sticky lg:top-8 space-y-6">
      {/* Pricing */}
      <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-2)] p-6">
        <PricingBlock
          backerPriceCents={campaign.backerPriceCents}
          retailPriceCents={campaign.retailPriceCents}
          currency={campaign.currency}
          depositPercent={campaign.depositPercent}
        />
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
        <CampaignProgressBar
          campaignId={campaign.id}
          initialCount={campaign.currentBackingCount}
          moq={campaign.moq}
          moqReached={campaign.moqReached}
          status={campaign.status}
          campaignEnd={campaign.campaignEnd}
        />
      </div>

      {/* Status-specific banners (sidebar) */}
      {campaign.status === "moq_reached" || campaign.status === "funded" ? (
        <MoqReachedBanner moqReachedAt={campaign.moqReachedAt} />
      ) : campaign.status === "in_production" ? (
        <InProductionBanner />
      ) : campaign.status === "shipped" ? (
        <ShippedBanner />
      ) : campaign.status === "completed" ? (
        <CompletedBanner />
      ) : campaign.status === "expired" ? (
        <ExpiredBanner />
      ) : campaign.status === "cancelled" ? (
        <CancelledBanner />
      ) : null}

      {/* Backing form (active campaigns only) */}
      {showForm && (
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-2)] p-6">
          <h2 className="font-display text-lg text-[var(--text-primary)] mb-6">
            Back this campaign
          </h2>
          <StripeProvider>
            <BackingForm
              campaignId={campaign.id}
              availableSizes={campaign.availableSizes}
              sizeBreaks={campaign.sizeBreaks}
              sizeLimits={campaign.sizeLimits}
              backerPriceCents={campaign.backerPriceCents}
              currency={campaign.currency}
            />
          </StripeProvider>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
        <h3 className="font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider mb-4">
          Timeline
        </h3>
        <TimelineSummary campaign={campaign} />
      </div>

      {/* Trust signals (sidebar) */}
      <div className="bg-[var(--surface-2)] rounded-[var(--radius-xl)] p-5">
        {[
          { icon: "🔒", text: "Secure payment via Stripe" },
          { icon: "💸", text: "Full refund if goal isn't reached" },
          { icon: "📧", text: "Email confirmation sent immediately" },
          { icon: "🚫", text: "Cancel anytime before goal is reached" },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-2.5 py-2 border-b border-[var(--surface-3)] last:border-0">
            <span className="text-sm">{icon}</span>
            <span className="text-xs text-[var(--text-secondary)]">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default async function CampaignPage({ params }: PageProps) {
  const campaign = await getCampaign(params.campaignId);

  // Not found or not public
  if (!campaign || campaign.status === "draft" || campaign.status === "scheduled") {
    notFound();
  }

  const isActive = campaign.status === "active";
  const showForm = isActive && !campaign.moqReached;

  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)]">
      {/* Minimal top nav */}
      <header className="sticky top-0 z-50 bg-[var(--loocbooc-white)]/90 backdrop-blur-md border-b border-[var(--surface-3)]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg tracking-tight text-[var(--loocbooc-black)] hover:opacity-80 transition-opacity"
          >
            loocbooc
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Live campaign
            </span>
          </div>
        </div>
      </header>

      {/* Hero image — full width */}
      {campaign.coverImageUrl && (
        <div className="relative h-[40vh] sm:h-[50vh] lg:h-[60vh] max-h-[640px] bg-[var(--surface-2)] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campaign.coverImageUrl}
            alt={campaign.title}
            className="w-full h-full object-cover"
            fetchPriority="high"
          />
          {/* Gradient overlay — darker at bottom for title legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Campaign title overlaid on hero */}
          <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 lg:px-16 pb-10 max-w-screen-xl mx-auto">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white leading-tight max-w-2xl drop-shadow-lg">
              {campaign.title}
            </h1>
          </div>
        </div>
      )}

      {/* Page body */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* If no cover image, show title here */}
        {!campaign.coverImageUrl && (
          <h1 className="font-display text-4xl sm:text-5xl text-[var(--text-primary)] mb-8 max-w-3xl">
            {campaign.title}
          </h1>
        )}

        {/* Mobile: progress + pricing above fold */}
        <div className="lg:hidden mb-8 space-y-4">
          <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
            <PricingBlock
              backerPriceCents={campaign.backerPriceCents}
              retailPriceCents={campaign.retailPriceCents}
              currency={campaign.currency}
              depositPercent={campaign.depositPercent}
            />
          </div>
          <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-5">
            <CampaignProgressBar
              campaignId={campaign.id}
              initialCount={campaign.currentBackingCount}
              moq={campaign.moq}
              moqReached={campaign.moqReached}
              status={campaign.status}
              campaignEnd={campaign.campaignEnd}
            />
          </div>

          {/* Status banners — mobile */}
          {(campaign.status === "moq_reached" || campaign.status === "funded") && (
            <MoqReachedBanner moqReachedAt={campaign.moqReachedAt} />
          )}
          {campaign.status === "in_production" && <InProductionBanner />}
          {campaign.status === "shipped" && <ShippedBanner />}
          {campaign.status === "completed" && <CompletedBanner />}
          {campaign.status === "expired" && <ExpiredBanner />}
          {campaign.status === "cancelled" && <CancelledBanner />}

          {/* Mobile backing form */}
          {showForm && (
            <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-2)] p-6">
              <h2 className="font-display text-xl text-[var(--text-primary)] mb-6">
                Back this campaign
              </h2>
              <StripeProvider>
                <BackingForm
                  campaignId={campaign.id}
                  availableSizes={campaign.availableSizes}
                  sizeBreaks={campaign.sizeBreaks}
                  sizeLimits={campaign.sizeLimits}
                  backerPriceCents={campaign.backerPriceCents}
                  currency={campaign.currency}
                />
              </StripeProvider>
            </div>
          )}
        </div>

        {/* Two-column layout on desktop */}
        <div className="flex flex-col lg:flex-row gap-12">

          {/* Left: campaign content */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Trust bar */}
            <TrustBar />

            {/* Description */}
            {campaign.description && (
              <CampaignDescription description={campaign.description} />
            )}

            {/* Gallery */}
            {campaign.galleryUrls.length > 0 && (
              <Gallery urls={campaign.galleryUrls} title={campaign.title} />
            )}

            {/* How it works */}
            <HowItWorks
              moq={campaign.moq}
              currency={campaign.currency}
              backerPriceCents={campaign.backerPriceCents}
              retailPriceCents={campaign.retailPriceCents}
            />

            {/* Mobile timeline */}
            <div className="lg:hidden bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)] p-6">
              <h3 className="font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                Timeline
              </h3>
              <TimelineSummary campaign={campaign} />
            </div>

            {/* Loocbooc footer note */}
            <div className="pt-6 border-t border-[var(--surface-3)]">
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed max-w-lg">
                This campaign is powered by{" "}
                <Link href="/" className="underline hover:no-underline">
                  Loocbooc
                </Link>
                {" "}— the platform where fashion gets made before it gets produced.
                All payments are processed securely via Stripe.
                Loocbooc handles automatic refunds if a campaign does not reach its goal.
              </p>
            </div>
          </div>

          {/* Right: sticky sidebar — desktop only */}
          <div className="hidden lg:block w-[380px] shrink-0">
            <CampaignSidebar campaign={campaign} showForm={showForm} />
          </div>
        </div>
      </div>
    </div>
  );
}
