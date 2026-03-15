/**
 * CampaignProgressBar — Client Component.
 *
 * Real-time MOQ progress bar. Subscribes to Supabase Realtime on mount
 * so the counter ticks up live as other users back the campaign.
 *
 * This is the core urgency driver. The moment the number moves,
 * undecided visitors are reminded others are committing.
 */

"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";

interface CampaignProgressBarProps {
  campaignId: string;
  initialCount: number;
  moq: number;
  moqReached: boolean;
  status: string;
  campaignEnd?: string | null;
}

function pluralise(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

function DaysRemaining({ campaignEnd }: { campaignEnd: string }) {
  const ms = new Date(campaignEnd).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days <= 0) return null;
  return (
    <div className="flex flex-col items-center min-w-[52px]">
      <span className="font-display text-2xl text-[var(--text-primary)] tabular-nums leading-none">
        {days}
      </span>
      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
        {days === 1 ? "day" : "days"}
      </span>
    </div>
  );
}

export function CampaignProgressBar({
  campaignId,
  initialCount,
  moq,
  moqReached: initialMoqReached,
  status,
  campaignEnd,
}: CampaignProgressBarProps) {
  const [count, setCount] = useState(initialCount);
  const [moqJustReached, setMoqJustReached] = useState(false);
  const [prevCount, setPrevCount] = useState(initialCount);

  const pct = Math.min(100, Math.round((count / moq) * 100));
  const needed = Math.max(0, moq - count);
  const isComplete = count >= moq;

  // Subscribe to real-time updates
  useEffect(() => {
    if (!["active", "moq_reached", "funded"].includes(status)) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`campaign-progress:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newCount = payload.new["current_backing_count"] as number | undefined;
          const newMoqReached = payload.new["moq_reached"] as boolean | undefined;

          if (newCount !== undefined) {
            setPrevCount((prev) => {
              setCount(newCount);
              return prev;
            });
          }
          if (newMoqReached && !initialMoqReached) {
            setMoqJustReached(true);
            // Remove the celebratory flash after 4 seconds
            setTimeout(() => setMoqJustReached(false), 4000);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, status, initialMoqReached]);

  // Detect when count just incremented (someone backed in real time)
  const justIncremented = count > prevCount;
  useEffect(() => {
    if (justIncremented) {
      const t = setTimeout(() => setPrevCount(count), 600);
      return () => clearTimeout(t);
    }
  }, [count, justIncremented]);

  return (
    <div className="space-y-4">
      {/* MOQ just reached — flash banner */}
      {moqJustReached && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-5 py-3 bg-[#22C55E] text-white text-center text-sm font-semibold rounded-[var(--radius-lg)] animate-pulse"
        >
          🎉 Just hit the goal! This campaign is going to production.
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between gap-4">
        {/* Backer count */}
        <div className="flex flex-col">
          <span
            className={`font-display text-4xl leading-none tabular-nums transition-all duration-300 ${
              justIncremented ? "text-[#22C55E]" : "text-[var(--text-primary)]"
            }`}
          >
            {count.toLocaleString()}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] mt-1">
            of {pluralise(moq, "backer")} needed
          </span>
        </div>

        {/* Right-side stats */}
        <div className="flex items-center gap-6">
          {!isComplete && needed > 0 && (
            <div className="flex flex-col items-center">
              <span className="font-display text-2xl text-[var(--text-primary)] tabular-nums leading-none">
                {needed.toLocaleString()}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                to go
              </span>
            </div>
          )}

          {campaignEnd && status === "active" && (
            <>
              <div className="w-px h-8 bg-[var(--surface-3)]" />
              <DaysRemaining campaignEnd={campaignEnd} />
            </>
          )}

          <div className="flex flex-col items-center">
            <span
              className={`font-display text-2xl tabular-nums leading-none ${
                isComplete ? "text-[#22C55E]" : "text-[var(--text-primary)]"
              }`}
            >
              {pct}%
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
              funded
            </span>
          </div>
        </div>
      </div>

      {/* Progress track */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of goal reached`}
        className="relative h-3 bg-[var(--surface-2)] rounded-full overflow-hidden"
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: isComplete ? "#22C55E" : "#6366f1",
          }}
        />
        {/* Shimmer effect when live */}
        {status === "active" && !isComplete && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 2s infinite linear",
            }}
          />
        )}
      </div>

      {/* Label */}
      {isComplete ? (
        <p className="text-sm font-semibold text-[#22C55E]">
          ✅ Goal reached — this campaign is going to production!
        </p>
      ) : status === "active" ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {pluralise(needed, "more backer")} needed to trigger production.
          {" "}Refund guaranteed if the goal isn&apos;t reached.
        </p>
      ) : null}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
