/**
 * Back It campaign page — the core consumer-facing product page.
 *
 * Features:
 * - Campaign details + gallery
 * - Real-time MOQ progress bar (Supabase Realtime subscription)
 * - Size selection with per-size availability
 * - "Back It" CTA → backing flow
 * - Live backing count (updates without polling as others back)
 *
 * Architecture note: The page shell is a Server Component (fast initial load,
 * SEO-friendly). The progress bar and interactive backing UI are Client Components
 * that subscribe to Supabase Realtime updates.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CampaignProgressBar } from "../../../../components/back-it/CampaignProgressBar";
import { BackingForm } from "../../../../components/back-it/BackingForm";
import { API_URL } from "../../../../lib/supabase";
import type { BackItCampaign, SizeBreak } from "../../../../../../packages/types/src";
import type { ApiResponse } from "../../../../../../packages/types/src";

interface PageProps {
  params: { campaignId: string };
}

interface CampaignWithSizeBreaks extends BackItCampaign {
  sizeBreaks: SizeBreak[];
}

async function getCampaign(id: string): Promise<CampaignWithSizeBreaks | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/back-it/campaigns/${id}`, {
      // Cache for 30 seconds — the real-time updates handle live data
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<CampaignWithSizeBreaks>;
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const campaign = await getCampaign(params.campaignId);
  if (!campaign) return { title: "Campaign Not Found" };

  return {
    title: campaign.title,
    description: campaign.description ?? `Back this campaign at ${(campaign.backerPriceCents / 100).toFixed(2)} ${campaign.currency}`,
    openGraph: {
      title: campaign.title,
      description: campaign.description ?? "",
      images: campaign.coverImageUrl ? [campaign.coverImageUrl] : [],
    },
  };
}

export default async function CampaignPage({ params }: PageProps) {
  const campaign = await getCampaign(params.campaignId);

  if (!campaign) {
    notFound();
  }

  const isActive = campaign.status === "active";
  const isMoqReached = campaign.moqReached;
  const savingsPercent = Math.round(
    ((campaign.retailPriceCents - campaign.backerPriceCents) / campaign.retailPriceCents) * 100,
  );

  return (
    <div className="campaign-page">

      {/* Campaign header */}
      <section className="campaign-header">
        {campaign.coverImageUrl && (
          <div className="campaign-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.coverImageUrl}
              alt={campaign.title}
              className="cover-image"
            />
          </div>
        )}

        <div className="campaign-info">
          <h1 className="campaign-title">{campaign.title}</h1>
          {campaign.description && (
            <p className="campaign-description">{campaign.description}</p>
          )}

          <div className="pricing">
            <div className="backer-price">
              <span className="label">Back It price</span>
              <span className="amount">
                {(campaign.backerPriceCents / 100).toFixed(2)} {campaign.currency}
              </span>
            </div>
            <div className="retail-price">
              <span className="label">Retail after production</span>
              <span className="amount strikethrough">
                {(campaign.retailPriceCents / 100).toFixed(2)} {campaign.currency}
              </span>
              <span className="savings-badge">{savingsPercent}% off</span>
            </div>
          </div>

          {campaign.estimatedShipDate && (
            <p className="ship-date">
              Estimated ship: {new Date(campaign.estimatedShipDate).toDateString()}
            </p>
          )}
        </div>
      </section>

      {/* Real-time progress bar — Client Component */}
      <section className="campaign-progress">
        <CampaignProgressBar
          campaignId={campaign.id}
          initialCount={campaign.currentBackingCount}
          moq={campaign.moq}
          moqReached={isMoqReached}
          status={campaign.status}
        />
      </section>

      {/* Backing form — Client Component */}
      {isActive && !isMoqReached && (
        <section className="backing-form-section">
          <BackingForm
            campaignId={campaign.id}
            availableSizes={campaign.availableSizes}
            sizeBreaks={campaign.sizeBreaks}
            sizeLimits={campaign.sizeLimits as Record<string, number> | null}
            backerPriceCents={campaign.backerPriceCents}
            currency={campaign.currency}
          />
        </section>
      )}

      {isMoqReached && (
        <div className="moq-reached-banner">
          🎉 This campaign has hit its goal and is now in production!
        </div>
      )}

      {campaign.status === "expired" && (
        <div className="expired-banner">
          This campaign has ended without reaching its goal.
        </div>
      )}

      {/* Gallery */}
      {campaign.galleryUrls.length > 0 && (
        <section className="campaign-gallery">
          <h2>Gallery</h2>
          <div className="gallery-grid">
            {campaign.galleryUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`${campaign.title} ${i + 1}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
