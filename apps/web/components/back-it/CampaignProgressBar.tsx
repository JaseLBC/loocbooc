/**
 * Campaign progress bar — Client Component.
 *
 * Shows real-time MOQ progress. Subscribes to Supabase Realtime on mount
 * so the counter updates live as other users back the campaign.
 * This is the core UX feature that drives backing urgency.
 */

"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { calculateMoqProgress, backingsNeeded } from "../../../../packages/utils/src/moq";
import type { CampaignStatus } from "../../../../packages/types/src";

interface CampaignProgressBarProps {
  campaignId: string;
  initialCount: number;
  moq: number;
  moqReached: boolean;
  status: CampaignStatus;
}

export function CampaignProgressBar({
  campaignId,
  initialCount,
  moq,
  moqReached: initialMoqReached,
  status,
}: CampaignProgressBarProps) {
  const [backingCount, setBackingCount] = useState(initialCount);
  const [moqJustReached, setMoqJustReached] = useState(false);

  const percent = calculateMoqProgress(backingCount, moq);
  const needed = backingsNeeded(backingCount, moq);

  useEffect(() => {
    // Don't subscribe for inactive campaigns
    if (!["active", "moq_reached", "funded"].includes(status)) return;

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`campaign:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload: { new: { current_backing_count?: number; moq_reached?: boolean } }) => {
          const newCount = payload.new.current_backing_count;
          if (newCount !== undefined) {
            setBackingCount(newCount);
          }
          if (payload.new.moq_reached && !initialMoqReached) {
            setMoqJustReached(true);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, status, initialMoqReached]);

  return (
    <div className="campaign-progress-bar">

      {moqJustReached && (
        <div
          role="alert"
          className="moq-reached-toast"
          aria-live="assertive"
        >
          🎉 Just hit the goal!
        </div>
      )}

      <div className="progress-stats">
        <div className="backing-count">
          <span className="count-number">{backingCount}</span>
          <span className="count-label"> of {moq} backers</span>
        </div>
        {!initialMoqReached && needed > 0 && (
          <div className="needed">
            {needed} more needed
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% of goal reached`}
      >
        <div
          className="progress-fill"
          style={{
            width: `${percent}%`,
            transition: "width 0.6s ease-in-out",
            backgroundColor: percent >= 100 ? "#22c55e" : "#6366f1",
          }}
        />
      </div>

      <div className="progress-label">
        {percent >= 100
          ? "Goal reached ✅"
          : `${percent}% of goal`}
      </div>
    </div>
  );
}
