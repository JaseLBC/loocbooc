/**
 * Loocbooc — Public Homepage
 *
 * The front door of the platform. Serves three audiences simultaneously:
 *   1. Consumers — discover and back pre-production fashion
 *   2. Brands — launch demand validation campaigns, connect with manufacturers
 *   3. Manufacturers — get found, fill capacity, grow their client base
 *
 * Architecture:
 * - React Server Component — SSR for SEO, instant first paint
 * - Active campaigns fetched server-side (ISR, revalidate every 60s)
 * - Client interactions (nav scroll, video, scroll animations) are minimal inline JS
 * - No external UI library dependencies — pure design system tokens
 *
 * Design philosophy:
 * - Fashion-native: DM Serif Display for big moments, Inter for everything else
 * - Apple-level precision in spacing, motion, and touch targets
 * - The primary colour is black + white + one accent. No colour noise.
 * - Every section serves a conversion goal, not a design exercise
 *
 * SEO:
 * - Full OpenGraph metadata
 * - Structured data for the platform
 * - Canonical URL set in metadata
 */

import type { Metadata } from "next";
import Link from "next/link";
import { API_URL } from "../lib/supabase";
import { HomepageClient } from "./HomepageClient";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Campaign {
  id: string;
  title: string;
  slug: string;
  brandName?: string;
  coverImageUrl: string | null;
  retailPriceCents: number;
  backerPriceCents: number;
  currency: string;
  moq: number;
  currentBackingCount: number;
  moqReached: boolean;
  campaignEnd: string;
  availableSizes: string[];
}

interface CampaignResponse {
  data: Campaign[];
  pagination?: {
    total: number;
  };
}

// ─────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Loocbooc — The Fashion Industry OS",
  description:
    "Back pre-production fashion before it exists. Try anything on your avatar. Connect brands with manufacturers. The platform where fashion gets made.",
  openGraph: {
    title: "Loocbooc — The Fashion Industry OS",
    description:
      "Back pre-production fashion before it exists. Try anything on your avatar. Connect brands with manufacturers.",
    type: "website",
    url: "https://loocbooc.com",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Loocbooc — The Fashion Industry OS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loocbooc — The Fashion Industry OS",
    description:
      "Back pre-production fashion before it exists. Try anything on your avatar.",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "https://loocbooc.com",
  },
};

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

async function getActiveCampaigns(): Promise<Campaign[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/back-it/campaigns?status=active&limit=6&sort=most_backed`,
      {
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as CampaignResponse;
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Server-rendered hero sections
// These are static — no interactivity needed
// ─────────────────────────────────────────────

function NavBar() {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 22,
            fontWeight: 400,
            color: "#0a0a0a",
            textDecoration: "none",
            letterSpacing: "-0.02em",
            flexShrink: 0,
          }}
        >
          loocbooc
        </Link>

        {/* Desktop nav links */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <style>{`
            @media (max-width: 639px) {
              .looc-nav-links { display: none !important; }
            }
          `}</style>
          <div
            className="looc-nav-links"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {[
              { label: "Explore", href: "/explore" },
              { label: "For Brands", href: "#brands" },
              { label: "For Manufacturers", href: "#manufacturers" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                style={{
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#444",
                  textDecoration: "none",
                  borderRadius: 8,
                  transition: "background 150ms, color 150ms",
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#f5f5f5";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#0a0a0a";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#444";
                }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Auth CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/auth/login"
              style={{
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "#0a0a0a",
                textDecoration: "none",
                borderRadius: 8,
              }}
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              style={{
                padding: "8px 18px",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "#0a0a0a",
                textDecoration: "none",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Get started
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// Hero section
// ─────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      style={{
        paddingTop: 140,
        paddingBottom: 80,
        paddingLeft: 24,
        paddingRight: 24,
        maxWidth: 1280,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* Category pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#f0ede8",
          borderRadius: 999,
          padding: "6px 14px",
          marginBottom: 32,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#22C55E",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#5a4d3e" }}>
          Now live — Back It campaigns
        </span>
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: "clamp(42px, 7vw, 88px)",
          fontWeight: 400,
          color: "#0a0a0a",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          margin: "0 0 28px",
          maxWidth: 880,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        Fashion made on demand.
        <br />
        <span style={{ color: "#c8b49a" }}>Before it exists.</span>
      </h1>

      {/* Subheadline */}
      <p
        style={{
          fontSize: "clamp(16px, 2.5vw, 20px)",
          color: "#666",
          lineHeight: 1.6,
          maxWidth: 560,
          margin: "0 auto 48px",
        }}
      >
        Back pre-production styles from independent brands. Try them on your avatar.
        Get them made at better prices — or your money back.
      </p>

      {/* CTAs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/explore"
          style={{
            padding: "15px 32px",
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            background: "#0a0a0a",
            borderRadius: 12,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Browse campaigns
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="#brands"
          style={{
            padding: "15px 32px",
            fontSize: 16,
            fontWeight: 500,
            color: "#0a0a0a",
            background: "transparent",
            border: "1.5px solid #e0e0e0",
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          For brands →
        </Link>
      </div>

      {/* Social proof */}
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        {[
          { stat: "Zero waste", label: "Only what sells gets made" },
          { stat: "100% refund", label: "If goal isn't reached" },
          { stat: "Backer price", label: "Below retail — guaranteed" },
        ].map(({ stat, label }) => (
          <div key={stat} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#0a0a0a",
                marginBottom: 2,
              }}
            >
              {stat}
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Campaign card (server-rendered)
// ─────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = Math.min(
    Math.round((campaign.currentBackingCount / campaign.moq) * 100),
    100,
  );
  const savingsPct = Math.round(
    ((campaign.retailPriceCents - campaign.backerPriceCents) / campaign.retailPriceCents) * 100,
  );
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(campaign.campaignEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
      cents / 100,
    );

  return (
    <Link
      href={`/back/${campaign.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        background: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #f0f0f0",
        transition: "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease",
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 16px 48px rgba(0,0,0,0.10)";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
      }}
    >
      {/* Cover image */}
      <div
        style={{
          aspectRatio: "4/3",
          background: "#f5f5f0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {campaign.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.coverImageUrl}
            alt={campaign.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 14,
              color: "#bbb",
              letterSpacing: "0.05em",
            }}
          >
            LOOCBOOC
          </div>
        )}

        {/* Savings badge */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "#0a0a0a",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 999,
          }}
        >
          Save {savingsPct}%
        </div>

        {/* MOQ reached badge */}
        {campaign.moqReached && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "#22C55E",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              letterSpacing: "0.02em",
            }}
          >
            🎉 GOAL REACHED
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "16px 18px 18px" }}>
        {/* Brand name */}
        {campaign.brandName && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#888",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            {campaign.brandName}
          </p>
        )}

        {/* Campaign title */}
        <h3
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 18,
            fontWeight: 400,
            color: "#0a0a0a",
            lineHeight: 1.3,
            marginBottom: 12,
            letterSpacing: "-0.01em",
          }}
        >
          {campaign.title}
        </h3>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 4,
              background: "#f0f0f0",
              borderRadius: 999,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: campaign.moqReached ? "#22C55E" : "#0a0a0a",
                borderRadius: 999,
                transition: "width 600ms cubic-bezier(0, 0, 0.2, 1)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#888",
            }}
          >
            <span>
              <strong style={{ color: "#0a0a0a" }}>
                {campaign.currentBackingCount.toLocaleString()}
              </strong>{" "}
              / {campaign.moq.toLocaleString()} backers
            </span>
            {!campaign.moqReached && daysLeft > 0 && (
              <span>{daysLeft}d left</span>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingTop: 10,
            borderTop: "1px solid #f5f5f5",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#0a0a0a",
                letterSpacing: "-0.02em",
              }}
            >
              {campaign.currency} {fmt(campaign.backerPriceCents)}
            </span>
            <span
              style={{
                fontSize: 13,
                color: "#bbb",
                textDecoration: "line-through",
                marginLeft: 8,
              }}
            >
              {fmt(campaign.retailPriceCents)}
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              color: "#666",
              fontWeight: 500,
            }}
          >
            Back it →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Live campaigns section
// ─────────────────────────────────────────────

function CampaignsSection({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section
      style={{
        padding: "80px 24px",
        background: "#fafaf8",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 48,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Live now
            </p>
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 400,
                color: "#0a0a0a",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Back these before they exist
            </h2>
          </div>
          <Link
            href="/explore"
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "#0a0a0a",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            View all campaigns
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Campaign grid */}
        {campaigns.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        ) : (
          /* Empty state — platform is new, show a compelling placeholder */
          <div
            style={{
              textAlign: "center",
              padding: "80px 24px",
            }}
          >
            <p
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 24,
                color: "#ccc",
                marginBottom: 16,
              }}
            >
              The first campaigns are coming.
            </p>
            <p style={{ fontSize: 15, color: "#999", marginBottom: 32 }}>
              Brands are setting up their first campaigns right now.
            </p>
            <Link
              href="/auth/register?role=brand"
              style={{
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#0a0a0a",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              Launch the first campaign →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// How it works section (consumer)
// ─────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Discover",
      description:
        "Browse pre-production styles from independent fashion brands. Every campaign tells you exactly how many people need to back it before it gets made.",
      icon: "🔍",
    },
    {
      number: "02",
      title: "Back it",
      description:
        "Pay the backer price — always below retail. Your money is held securely and only charged when the campaign hits its goal.",
      icon: "💳",
    },
    {
      number: "03",
      title: "It gets made",
      description:
        "When enough backers commit, the brand locks in production. You get updates as your item moves from pattern to manufacturer to your door.",
      icon: "🏭",
    },
    {
      number: "04",
      title: "Or you get refunded",
      description:
        "If the campaign doesn't reach its goal, every backer receives a full automatic refund. No action needed. No questions asked.",
      icon: "🔒",
    },
  ];

  return (
    <section
      style={{
        padding: "80px 24px",
        background: "#fff",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 64, maxWidth: 600 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#888",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            How Back It works
          </p>
          <h2
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 400,
              color: "#0a0a0a",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: "0 0 16px",
            }}
          >
            Fashion made on your terms.
          </h2>
          <p style={{ fontSize: 16, color: "#666", lineHeight: 1.6, margin: 0 }}>
            No overproduction. No waste. No paying retail for something that
            already existed in a warehouse. You back it. It gets made. Simple.
          </p>
        </div>

        {/* Steps grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 32,
          }}
        >
          {steps.map((step) => (
            <div key={step.number}>
              {/* Icon + number */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#f5f5f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#ccc",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {step.number}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#0a0a0a",
                  marginBottom: 10,
                }}
              >
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.65, margin: 0 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 64, textAlign: "center" }}>
          <Link
            href="/explore"
            style={{
              padding: "15px 36px",
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              background: "#0a0a0a",
              borderRadius: 12,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Browse live campaigns
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Avatar / virtual try-on teaser
// ─────────────────────────────────────────────

function AvatarSection() {
  return (
    <section
      style={{
        padding: "80px 24px",
        background: "#0a0a0a",
        color: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 64,
          alignItems: "center",
        }}
      >
        {/* Text */}
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#666",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Universal Avatar
          </p>
          <h2
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 400,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: "0 0 24px",
            }}
          >
            Try it on before it gets made.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#999",
              lineHeight: 1.7,
              marginBottom: 32,
            }}
          >
            Create your avatar with your real measurements. See exactly how a
            campaign garment will fit your body — before you commit. Recommended
            sizes. Fit confidence. No surprises.
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 40px" }}>
            {[
              "Your measurements, not a size chart",
              "Fit score on every campaign",
              "Size recommendation calculated for you",
            ].map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 15,
                  color: "#ddd",
                  marginBottom: 12,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#22C55E" strokeWidth={1.5} />
                  <path d="M8 12l3 3 5-5" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <Link
            href="/avatar/create"
            style={{
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 600,
              color: "#0a0a0a",
              background: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Create your avatar
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Visual placeholder (3D avatar would render here) */}
        <div
          style={{
            aspectRatio: "3/4",
            maxHeight: 520,
            borderRadius: 24,
            background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative grid */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.03) 40px)",
            }}
          />
          {/* Avatar silhouette placeholder */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              textAlign: "center",
            }}
          >
            <svg
              width="120"
              height="200"
              viewBox="0 0 120 200"
              fill="none"
              opacity={0.3}
            >
              {/* Simple figure silhouette */}
              <circle cx="60" cy="28" r="20" fill="#fff" />
              <path
                d="M30 80 C30 56 90 56 90 80 L95 160 H70 L60 130 L50 160 H25 Z"
                fill="#fff"
              />
              <path d="M30 80 L10 120" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
              <path d="M90 80 L110 120" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
            </svg>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 13,
                marginTop: 16,
                letterSpacing: "0.04em",
              }}
            >
              Your avatar
            </p>
          </div>

          {/* Fit chip floating */}
          <div
            style={{
              position: "absolute",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "10px 16px",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "#22C55E" }}>
              Size 12
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              · 94% fit confidence
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// For Brands section
// ─────────────────────────────────────────────

function ForBrandsSection() {
  const features = [
    {
      icon: "📊",
      title: "Validate demand before production",
      description:
        "Set a minimum order quantity. When backers hit it, production is confirmed. If they don't, everyone's refunded automatically. Zero inventory risk.",
    },
    {
      icon: "🏭",
      title: "Connect with verified manufacturers",
      description:
        "When your campaign hits MOQ, your manufacturer is automatically notified with size breaks and tech pack. Production begins without a single email.",
    },
    {
      icon: "📐",
      title: "Full PLM tools included",
      description:
        "Manage styles from concept to production in one place. Cost tracking, sample rounds, stage milestones. Your entire supply chain in one dashboard.",
    },
    {
      icon: "📦",
      title: "Your Shopify store, powered up",
      description:
        "Install the Loocbooc Shopify app and add Back It campaigns directly to your product pages. No redirect. No separate checkout. Just demand, validated.",
    },
    {
      icon: "📈",
      title: "Real size data from real customers",
      description:
        "Every backing includes a size selection. Before you cut a single pattern, you know your exact size distribution. Grade to your actual customers.",
    },
    {
      icon: "🎯",
      title: "Consumer intelligence included",
      description:
        "The Taste Engine learns from every interaction on the platform. Your campaigns are surfaced to the consumers most likely to back them.",
    },
  ];

  return (
    <section
      id="brands"
      style={{
        padding: "80px 24px",
        background: "#fff",
        scrollMarginTop: 80,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 48,
            marginBottom: 64,
            alignItems: "end",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              For fashion brands
            </p>
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 400,
                color: "#0a0a0a",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Make what sells.
              <br />
              Before you make it.
            </h2>
          </div>
          <div>
            <p
              style={{
                fontSize: 16,
                color: "#666",
                lineHeight: 1.7,
                marginBottom: 28,
              }}
            >
              Loocbooc gives brands a demand validation platform, a manufacturer
              marketplace, and a full PLM system — all connected. This is how
              independent brands compete with the big end.
            </p>
            <Link
              href="/auth/register?role=brand"
              style={{
                padding: "13px 26px",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#0a0a0a",
                borderRadius: 10,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Create brand account
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Features grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 2,
            background: "#f5f5f0",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {features.map((feature, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                padding: "28px 28px",
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  marginBottom: 14,
                }}
              >
                {feature.icon}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0a0a0a",
                  marginBottom: 10,
                  lineHeight: 1.3,
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#666",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// For Manufacturers section
// ─────────────────────────────────────────────

function ForManufacturersSection() {
  return (
    <section
      id="manufacturers"
      style={{
        padding: "80px 24px",
        background: "#fafaf8",
        scrollMarginTop: 80,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Feature list */}
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              For manufacturers
            </p>
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 400,
                color: "#0a0a0a",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                margin: "0 0 20px",
              }}
            >
              Fill your capacity.
              <br />
              On your terms.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#666",
                lineHeight: 1.7,
                marginBottom: 40,
              }}
            >
              Independent fashion brands are looking for manufacturers right now.
              Create your profile. Get found. The platform does the matching.
            </p>

            {/* Feature list */}
            <div style={{ marginBottom: 40 }}>
              {[
                {
                  icon: "🔎",
                  title: "Get discovered by brands",
                  desc: "Brands search manufacturers by specialisation, location, certifications, and MOQ. Build your profile and let them find you.",
                },
                {
                  icon: "📋",
                  title: "Automatic production orders",
                  desc: "When a Back It campaign hits MOQ, you receive an automated notification with size breaks, tech pack, and timeline — no chasing required.",
                },
                {
                  icon: "⭐",
                  title: "Build your reputation",
                  desc: "Every completed production order adds to your rating. A strong Loocbooc rating opens doors that cold outreach never will.",
                },
                {
                  icon: "🌏",
                  title: "Brands across AU, US, and EU",
                  desc: "Loocbooc connects manufacturers with independent brands globally. Fill seasonal gaps with brands from markets where it's a different season.",
                },
              ].map(({ icon, title, desc }) => (
                <div
                  key={title}
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 24,
                    paddingBottom: 24,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: "#f0ede8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#0a0a0a",
                        marginBottom: 5,
                      }}
                    >
                      {title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#666",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/auth/register?role=manufacturer"
              style={{
                padding: "13px 26px",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#0a0a0a",
                borderRadius: 10,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Create manufacturer profile
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Stats panel */}
          <div
            style={{
              background: "#0a0a0a",
              borderRadius: 24,
              padding: "40px 36px",
              color: "#fff",
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#666",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 32,
              }}
            >
              The opportunity
            </p>

            {[
              {
                stat: "$3T",
                label: "Global fashion market",
                sub: "Growing 5% annually",
              },
              {
                stat: "30%",
                label: "Industry waste rate",
                sub: "What Loocbooc is built to eliminate",
              },
              {
                stat: "$600B",
                label: "Fashion overproduction",
                sub: "Destroyed or landfilled annually",
              },
              {
                stat: "1",
                label: "Platform that solves it",
                sub: "You're here early",
              },
            ].map(({ stat, label, sub }) => (
              <div
                key={label}
                style={{
                  paddingBottom: 24,
                  marginBottom: 24,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 40,
                    fontWeight: 400,
                    color: "#fff",
                    lineHeight: 1,
                    marginBottom: 6,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {stat}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#ddd",
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 13, color: "#666" }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Fashion Intelligence teaser
// ─────────────────────────────────────────────

function IntelligenceSection() {
  return (
    <section
      style={{
        padding: "80px 24px",
        background: "#fff",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#888",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          The intelligence layer
        </p>
        <h2
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 400,
            color: "#0a0a0a",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 auto 20px",
            maxWidth: 720,
          }}
        >
          The more people use Loocbooc,
          <br />
          the smarter it gets.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#666",
            lineHeight: 1.7,
            maxWidth: 600,
            margin: "0 auto 64px",
          }}
        >
          Every backing, every size selection, every avatar measurement — it all feeds
          the Taste Engine. Which surfaces the right campaigns to the right consumers.
          Which drives higher conversion for brands. Which fills manufacturer capacity
          more efficiently. The flywheel compounds.
        </p>

        {/* Flywheel visual */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            flexWrap: "wrap",
            rowGap: 0,
          }}
        >
          {[
            { label: "Consumer taste signals", bg: "#f5f5f0" },
            { arrow: true },
            { label: "Taste Engine learns", bg: "#f0ede8" },
            { arrow: true },
            { label: "Better recommendations", bg: "#f5f5f0" },
            { arrow: true },
            { label: "More backings", bg: "#f0ede8" },
            { arrow: true },
            { label: "More production data", bg: "#f5f5f0" },
          ].map((item, i) =>
            "arrow" in item ? (
              <div key={i} style={{ padding: "0 8px", color: "#ccc", fontSize: 20 }}>
                →
              </div>
            ) : (
              <div
                key={i}
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: item.bg,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#333",
                  whiteSpace: "nowrap",
                  margin: "4px 0",
                }}
              >
                {item.label}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// CTA section
// ─────────────────────────────────────────────

function CtaSection() {
  return (
    <section
      style={{
        padding: "80px 24px 100px",
        background: "#0a0a0a",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: "clamp(32px, 5vw, 56px)",
            fontWeight: 400,
            color: "#fff",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 20px",
          }}
        >
          Fashion doesn&apos;t have to be made in advance.
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "#999",
            lineHeight: 1.7,
            marginBottom: 48,
          }}
        >
          Back what you want. Brands make what sells. Manufacturers fill capacity
          efficiently. The platform that does all three simultaneously — welcome to Loocbooc.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/auth/register"
            style={{
              padding: "15px 36px",
              fontSize: 16,
              fontWeight: 600,
              color: "#0a0a0a",
              background: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Create your account
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/explore"
            style={{
              padding: "15px 36px",
              fontSize: 16,
              fontWeight: 500,
              color: "#fff",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              textDecoration: "none",
            }}
          >
            Browse campaigns
          </Link>
        </div>

        {/* Tagline */}
        <p
          style={{
            marginTop: 40,
            fontSize: 13,
            color: "#444",
            letterSpacing: "0.06em",
          }}
        >
          Free to join. No inventory risk. No overproduction.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "#0a0a0a",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "48px 24px",
        color: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 40,
        }}
      >
        {/* Brand */}
        <div>
          <div
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 22,
              color: "#fff",
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            loocbooc
          </div>
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: 0 }}>
            The fashion industry operating system.
          </p>
        </div>

        {/* For consumers */}
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            For shoppers
          </h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              { label: "Explore campaigns", href: "/explore" },
              { label: "My style profile", href: "/style" },
              { label: "My avatar", href: "/avatar" },
              { label: "How it works", href: "#how-it-works" },
            ].map(({ label, href }) => (
              <li key={label} style={{ marginBottom: 8 }}>
                <Link
                  href={href}
                  style={{
                    fontSize: 14,
                    color: "#666",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* For brands */}
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            For brands
          </h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              { label: "Create brand account", href: "/auth/register?role=brand" },
              { label: "Campaign management", href: "/campaigns" },
              { label: "PLM dashboard", href: "/plm" },
              { label: "Manufacturer search", href: "/manufacturers" },
            ].map(({ label, href }) => (
              <li key={label} style={{ marginBottom: 8 }}>
                <Link
                  href={href}
                  style={{
                    fontSize: 14,
                    color: "#666",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* For manufacturers */}
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            For manufacturers
          </h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              { label: "Create profile", href: "/auth/register?role=manufacturer" },
              { label: "Manufacturer dashboard", href: "/dashboard" },
              { label: "Active connections", href: "/connections" },
            ].map(({ label, href }) => (
              <li key={label} style={{ marginBottom: 8 }}>
                <Link
                  href={href}
                  style={{
                    fontSize: 14,
                    color: "#666",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Platform
          </h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              { label: "About", href: "/about" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
            ].map(({ label, href }) => (
              <li key={label} style={{ marginBottom: 8 }}>
                <Link
                  href={href}
                  style={{
                    fontSize: 14,
                    color: "#666",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1280,
          margin: "40px auto 0",
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p style={{ fontSize: 13, color: "#444", margin: 0 }}>
          © {currentYear} Loocbooc. All rights reserved.
        </p>
        <p style={{ fontSize: 13, color: "#333", margin: 0 }}>
          Built for the fashion industry. Powered by real demand.
        </p>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function HomePage() {
  const campaigns = await getActiveCampaigns();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#fff",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Google fonts — inline for zero FOUC */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::selection { background: #0a0a0a; color: #fff; }
        a { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <NavBar />
      <HeroSection />
      <CampaignsSection campaigns={campaigns} />
      <HowItWorksSection />
      <AvatarSection />
      <ForBrandsSection />
      <ForManufacturersSection />
      <IntelligenceSection />
      <CtaSection />
      <Footer />

      {/* Client-side scroll behavior + anchor smooth scroll */}
      <HomepageClient />
    </div>
  );
}
