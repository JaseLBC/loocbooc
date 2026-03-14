/**
 * Back It module-specific types not covered by @loocbooc/types.
 * Internal service return types and enriched response shapes.
 */

import type { Campaign, Backing, CampaignSizeBreak } from "../../../../../packages/database/generated/client";

export interface CampaignWithSizeBreaks extends Campaign {
  sizeBreaks: CampaignSizeBreak[];
}

export interface BackingWithCampaign extends Backing {
  campaign: Campaign;
}

export interface MoqCheckResult {
  campaignId: string;
  moqReached: boolean;
  currentCount: number;
  moq: number;
  alreadyTriggered: boolean;
}

export interface BackingResult {
  backing: Backing;
  moqJustReached: boolean;
  /** Set to true when the backing was already confirmed (idempotent re-call). */
  alreadyConfirmed?: boolean;
}
