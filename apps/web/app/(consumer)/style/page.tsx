"use client";

/**
 * My Style — consumer taste profile page.
 *
 * The human-facing window into the Taste Engine. Shows:
 * - Profile quality/completeness meter
 * - Top categories with visual bars
 * - Top colours as swatches
 * - Preferred brands
 * - Style keywords
 * - Personalised campaign feed
 * - Tips for improving the profile (if quality is low)
 *
 * All data comes from GET /api/v1/taste/profile and GET /api/v1/taste/campaigns
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types (mirroring API response shapes)
// ─────────────────────────────────────────────

interface CategoryScore {
  category: string;
  score: number;
  count: number;
}

interface ColourScore {
  colour: string;
  score: number;
  count: number;
}

interface BrandScore {
  brandId: string;
  brandName: string;
  score: number;
}

interface TasteProfile {
  userId: string;
  topCategories: CategoryScore[];
  topColours: ColourScore[];
  preferredBrands: BrandScore[];
  priceRangeMinCents: number | null;
  priceRangeMaxCents: number | null;
  styleKeywords: string[];
  occasions: string[];
  fitKeywords: string[];
  confirmedSizeAu: string | null;
  signalCount: number;
  modelQuality: number;
  lastBuiltAt: string;
  summary: {
    topCategories: string[];
    topColours: string[];
    preferredSizeAu: string | null;
    priceRange: string | null;
    hasEnoughData: boolean;
    insightsAvailable: number;
  };
}

interface CampaignRecommendation {
  campaignId: string;
  title: string;
  brandName: string;
  coverImageUrl: string | null;
  backerPriceCents: number;
  currency: string;
  currentBackingCount: number;
  moq: number;
  availableSizes: string[];
  relevanceScore: number;
  relevanceReasons: string[];
  recommendedSize: string | null;
}

// ─────────────────────────────────────────────
// Colour → CSS mapping
// ─────────────────────────────────────────────

const COLOUR_CSS: Record<string, string> = {
  black:       "#0a0a0a",
  white:       "#f9f9f9",
  navy:        "#1e3a5f",
  blue:        "#2563eb",
  red:         "#dc2626",
  green:       "#16a34a",
  pink:        "#ec4899",
  purple:      "#7c3aed",
  yellow:      "#f59e0b",
  orange:      "#ea580c",
  beige:       "#d4b896",
  cream:       "#f5f0e8",
  camel:       "#c19a6b",
  brown:       "#78350f",
  grey:        "#6b7280",
  gray:        "#6b7280",
  blush:       "#f4a7b9",
  olive:       "#6b7a1e",
  khaki:       "#c5b358",
  teal:        "#0d9488",
  rust:        "#b45309",
  sage:        "#87a878",
  mustard:     "#d4a017",
  charcoal:    "#374151",
  ivory:       "#fffff0",
  coral:       "#f87171",
  burgundy:    "#7f1d1d",
  emerald:     "#065f46",
  mint:        "#a7f3d0",
  lavender:    "#ede9fe",
  lilac:       "#c4b5fd",
};

function getColourCSS(name: string): string {
  return COLOUR_CSS[name.toLowerCase()] ?? "#e5e5e5";
}

// ─────────────────────────────────────────────
// Quality meter
// ─────────────────────────────────────────────

function QualityMeter({ quality, signalCount }: { quality: number; signalCount: number }) {
  const pct = Math.round(quality * 100);
  const label =
    quality >= 0.8 ? "Highly personalised" :
    quality >= 0.5 ? "Well calibrated" :
    quality >= 0.25 ? "Getting there" :
    "Just starting";
  const color =
    quality >= 0.8 ? "#16a34a" :
    quality >= 0.5 ? "#2563eb" :
    quality >= 0.25 ? "#d97706" :
    "#9ca3af";

  return (
    <div style={{
      background: "#f8f8f8",
      borderRadius: 16,
      padding: "20px",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Profile quality</div>
          <div style={{ fontSize: 13, color: "#666" }}>{signalCount} signals collected</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{pct}%</div>
          <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</div>
        </div>
      </div>
      <div style={{ height: 6, background: "#e5e5e5", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Category bars
// ─────────────────────────────────────────────

function CategoryBars({ categories }: { categories: CategoryScore[] }) {
  if (categories.length === 0) return null;
  const maxScore = categories[0]?.score ?? 1;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
        Top categories
      </h3>
      {categories.slice(0, 6).map(({ category, score, count }) => (
        <div key={category} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>
              {category}
            </span>
            <span style={{ fontSize: 12, color: "#888" }}>{count} signal{count !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${(score / maxScore) * 100}%`,
              background: "#0a0a0a",
              borderRadius: 3,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Colour swatches
// ─────────────────────────────────────────────

function ColourSwatches({ colours }: { colours: ColourScore[] }) {
  if (colours.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
        Colour palette
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {colours.slice(0, 8).map(({ colour }) => {
          const css = getColourCSS(colour);
          const isLight = css === "#f9f9f9" || css === "#f5f0e8" || css === "#fffff0" || css === "#ede9fe" || css === "#c4b5fd";
          return (
            <div
              key={colour}
              title={colour.charAt(0).toUpperCase() + colour.slice(1)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: css,
                border: isLight ? "2px solid #e5e5e5" : "2px solid transparent",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }} />
              <span style={{ fontSize: 10, color: "#666", textTransform: "capitalize" }}>
                {colour.length > 7 ? colour.slice(0, 6) + "…" : colour}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Keyword chips
// ─────────────────────────────────────────────

function KeywordChips({ keywords, label }: { keywords: string[]; label: string }) {
  if (keywords.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        {label}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {keywords.map((kw) => (
          <span key={kw} style={{
            padding: "5px 14px",
            background: "#f0f0f0",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            textTransform: "capitalize",
            color: "#333",
          }}>
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Campaign card
// ─────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: CampaignRecommendation }) {
  const progress = Math.round((campaign.currentBackingCount / campaign.moq) * 100);
  const price = (campaign.backerPriceCents / 100).toFixed(0);

  return (
    <Link
      href={`/back/${campaign.campaignId}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 14,
        border: "1.5px solid #e5e5e5",
        overflow: "hidden",
        marginBottom: 16,
        background: "#fff",
        transition: "border-color 0.2s",
      }}
    >
      {/* Campaign image placeholder */}
      <div style={{
        height: 160,
        background: campaign.coverImageUrl ? `url(${campaign.coverImageUrl}) center/cover` : "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}>
        {!campaign.coverImageUrl && (
          <span style={{ fontSize: 36 }}>👗</span>
        )}
        {/* Relevance badge */}
        {campaign.relevanceScore > 0.3 && (
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(10,10,10,0.85)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 20,
          }}>
            Recommended for you
          </div>
        )}
        {/* Recommended size badge */}
        {campaign.recommendedSize && (
          <div style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "#fff",
            color: "#0a0a0a",
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1.5px solid #0a0a0a",
          }}>
            Your size: {campaign.recommendedSize}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 2, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {campaign.brandName}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>
          {campaign.title}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
          {campaign.currency} ${price}
        </div>

        {/* MOQ progress */}
        <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
          <div style={{
            height: "100%",
            width: `${Math.min(progress, 100)}%`,
            background: progress >= 100 ? "#16a34a" : "#0a0a0a",
            borderRadius: 2,
          }} />
        </div>
        <div style={{ fontSize: 11, color: "#888" }}>
          {campaign.currentBackingCount} / {campaign.moq} backers ({progress}%)
        </div>

        {/* Relevance reasons */}
        {campaign.relevanceReasons.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {campaign.relevanceReasons.slice(0, 2).map((reason, i) => (
              <span key={i} style={{
                fontSize: 11,
                padding: "2px 8px",
                background: "#f0f0f0",
                borderRadius: 10,
                color: "#555",
              }}>
                {reason}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Building state
// ─────────────────────────────────────────────

function BuildingState({ signalCount }: { signalCount: number }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔮</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Learning your style
      </h2>
      <p style={{ color: "#666", fontSize: 14, maxWidth: 300, margin: "0 auto 28px", lineHeight: 1.6 }}>
        {signalCount > 0
          ? `We have ${signalCount} signal${signalCount !== 1 ? "s" : ""} so far. Keep browsing and your taste profile will appear shortly.`
          : "Start browsing campaigns to build your personalised style profile."}
      </p>
      <div style={{ background: "#f8f8f8", borderRadius: 14, padding: "20px", textAlign: "left", maxWidth: 320, margin: "0 auto" }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>How to build your profile faster</div>
        {[
          { icon: "🛍", text: "Browse and back campaigns" },
          { icon: "📏", text: "Complete your measurements" },
          { icon: "❤️", text: "Like and save styles you love" },
          { icon: "📋", text: "Take the style quiz" },
        ].map(({ icon, text }, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "#555" }}>
            <span>{icon}</span><span>{text}</span>
          </div>
        ))}
      </div>
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 28px",
          background: "#0a0a0a",
          color: "#fff",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Explore campaigns
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Profile tip
// ─────────────────────────────────────────────

function ImprovementTip({ profile }: { profile: TasteProfile }) {
  const { summary } = profile;
  if (summary.hasEnoughData) return null;

  const tips = [
    !summary.preferredSizeAu && {
      icon: "📏",
      title: "Add your measurements",
      desc: "We'll pre-select your size on every campaign",
      href: "/avatar/create",
      cta: "Set up avatar",
    },
    profile.styleKeywords.length === 0 && {
      icon: "📋",
      title: "Take the style quiz",
      desc: "Helps us understand your aesthetic faster",
      href: "/questionnaire-demo",
      cta: "Start quiz",
    },
    summary.topCategories.length < 2 && {
      icon: "🛍",
      title: "Browse more campaigns",
      desc: "More browsing = smarter recommendations",
      href: "/",
      cta: "Explore",
    },
  ].filter(Boolean) as Array<{ icon: string; title: string; desc: string; href: string; cta: string }>;

  if (tips.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Improve your profile
      </h3>
      {tips.map((tip, i) => (
        <Link
          key={i}
          href={tip.href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            background: "#f8f8f8",
            borderRadius: 12,
            textDecoration: "none",
            color: "inherit",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>{tip.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tip.title}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{tip.desc}</div>
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 12px",
            background: "#0a0a0a",
            color: "#fff",
            borderRadius: 8,
            flexShrink: 0,
          }}>
            {tip.cta}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function MyStylePage() {
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [signalCount, setSignalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignRecommendation[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [isPersonalised, setIsPersonalised] = useState(false);

  const [activeTab, setActiveTab] = useState<"profile" | "campaigns">("profile");

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/taste/profile", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/auth/login?redirect=/style";
        return;
      }
      const data = await res.json() as {
        profile: TasteProfile | null;
        signalCount: number;
        ready: boolean;
      };
      setProfile(data.profile);
      setSignalCount(data.signalCount);
      setProfileReady(data.ready);
    } catch {
      // handle
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/v1/taste/campaigns?limit=12", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as {
        campaigns: CampaignRecommendation[];
        isPersonalised: boolean;
      };
      setCampaigns(data.campaigns);
      setIsPersonalised(data.isPersonalised);
    } catch {
      // non-critical
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab === "campaigns") {
      loadCampaigns();
    }
  }, [activeTab, loadCampaigns]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#888", fontSize: 14 }}>Loading your style profile...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #f0f0f0",
        maxWidth: 520,
        margin: "0 auto",
      }}>
        <a href="/" style={{ fontSize: 16, fontWeight: 700, textDecoration: "none", color: "#0a0a0a" }}>
          loocbooc
        </a>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a" }}>My Style</div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 40px" }}>
        {/* Tab switcher */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #f0f0f0",
          padding: "0 20px",
        }}>
          {(["profile", "campaigns"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "14px 0",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${activeTab === tab ? "#0a0a0a" : "transparent"}`,
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 14,
                color: activeTab === tab ? "#0a0a0a" : "#888",
                cursor: "pointer",
                transition: "all 0.2s",
                textTransform: "capitalize",
              }}
            >
              {tab === "campaigns" ? "For You" : "Taste Profile"}
            </button>
          ))}
        </div>

        <div style={{ padding: "24px 20px" }}>

          {/* ── PROFILE TAB ──────────────────────────────────── */}
          {activeTab === "profile" && (
            <>
              {!profileReady ? (
                <BuildingState signalCount={signalCount} />
              ) : profile ? (
                <>
                  <QualityMeter quality={profile.modelQuality} signalCount={profile.signalCount} />

                  {/* Key stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                    {[
                      { label: "Preferred size", value: profile.summary.preferredSizeAu ?? "—", sub: "AU sizing" },
                      { label: "Price range", value: profile.summary.priceRange ?? "—", sub: "per item" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} style={{
                        background: "#f8f8f8",
                        borderRadius: 12,
                        padding: "14px 16px",
                      }}>
                        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>{value}</div>
                        <div style={{ fontSize: 11, color: "#aaa" }}>{sub}</div>
                      </div>
                    ))}
                  </div>

                  <ImprovementTip profile={profile} />
                  <CategoryBars categories={profile.topCategories} />
                  <ColourSwatches colours={profile.topColours} />

                  {profile.fitKeywords.length > 0 && (
                    <KeywordChips keywords={profile.fitKeywords} label="Fit preference" />
                  )}
                  {profile.occasions.length > 0 && (
                    <KeywordChips keywords={profile.occasions} label="Occasions" />
                  )}
                  {profile.styleKeywords.length > 0 && (
                    <KeywordChips keywords={profile.styleKeywords.slice(0, 10)} label="Style keywords" />
                  )}

                  {/* Preferred brands */}
                  {profile.preferredBrands.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                        Preferred brands
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {profile.preferredBrands.map(({ brandId, brandName }) => (
                          <span key={brandId} style={{
                            padding: "6px 14px",
                            background: "#0a0a0a",
                            color: "#fff",
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 600,
                          }}>
                            {brandName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Privacy note */}
                  <div style={{
                    padding: "14px 16px",
                    background: "#f8f8f8",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#888",
                    lineHeight: 1.6,
                  }}>
                    🔒 Your taste data is private. It's only used to improve recommendations for you — never shared with brands or sold.
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* ── CAMPAIGNS TAB ────────────────────────────────── */}
          {activeTab === "campaigns" && (
            <>
              {isPersonalised && (
                <div style={{
                  padding: "10px 14px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "#166534",
                  marginBottom: 20,
                  fontWeight: 500,
                }}>
                  ✨ Personalised based on your taste profile
                </div>
              )}

              {campaignsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#888", fontSize: 14 }}>
                  Finding campaigns for you...
                </div>
              ) : campaigns.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                  <p style={{ color: "#666", fontSize: 14 }}>No active campaigns right now. Check back soon.</p>
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <CampaignCard key={campaign.campaignId} campaign={campaign} />
                ))
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
