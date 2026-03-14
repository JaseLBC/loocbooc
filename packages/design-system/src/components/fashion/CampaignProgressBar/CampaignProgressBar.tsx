'use client';

/**
 * CampaignProgressBar — Back It MOQ progress bar.
 * Count + percentage + goal.
 * Celebratory animation when 100% is hit.
 * Real-time updates via NumberTicker.
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { NumberTicker } from '../../../animations/NumberTicker';

export interface CampaignProgressBarProps {
  backerCount: number;
  moq: number;
  /** Optional stretch goal */
  stretchGoal?: number;
  /** Days remaining */
  daysLeft?: number;
  /** Campaign currency */
  currency?: string;
  /** Show social proof ticker */
  showSocialProof?: boolean;
  recentBacker?: string;
  className?: string;
}

export function CampaignProgressBar({
  backerCount,
  moq,
  stretchGoal,
  daysLeft,
  showSocialProof = false,
  recentBacker,
  className,
}: CampaignProgressBarProps) {
  const percentage = Math.min(100, (backerCount / moq) * 100);
  const isComplete = percentage >= 100;
  const prevComplete = useRef(isComplete);
  const [celebrated, setCelebrated] = useState(false);

  // Trigger celebration animation when MOQ is first reached
  useEffect(() => {
    if (isComplete && !prevComplete.current) {
      setCelebrated(true);
      const timer = setTimeout(() => setCelebrated(false), 2000);
      return () => clearTimeout(timer);
    }
    prevComplete.current = isComplete;
  }, [isComplete]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Stats row */}
      <div className="flex items-end justify-between gap-4">
        {/* Left: backer count */}
        <div className="flex flex-col">
          <span className={cn(
            'text-3xl font-bold font-body tabular-nums leading-tight',
            isComplete ? 'text-success' : 'text-text-primary',
            celebrated && 'animate-celebrate',
          )}>
            <NumberTicker value={backerCount} />
          </span>
          <span className="text-sm text-text-secondary font-body">
            backers
          </span>
        </div>

        {/* Center: percentage */}
        <div className="flex flex-col items-center">
          <span className={cn(
            'text-xl font-semibold font-body tabular-nums',
            isComplete ? 'text-success' : 'text-text-primary',
          )}>
            <NumberTicker value={Math.round(percentage)} suffix="%" />
          </span>
          <span className="text-xs text-text-tertiary font-body">funded</span>
        </div>

        {/* Right: goal */}
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold text-text-primary font-body tabular-nums leading-tight">
            {moq}
          </span>
          <span className="text-sm text-text-secondary font-body">goal</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div
          className={cn(
            'w-full h-3 rounded-full overflow-hidden',
            'bg-surface-3',
          )}
          role="progressbar"
          aria-valuenow={backerCount}
          aria-valuemin={0}
          aria-valuemax={moq}
          aria-label={`${backerCount} of ${moq} backers — ${Math.round(percentage)}% funded`}
        >
          <div
            className={cn(
              'h-full rounded-full',
              'transition-all duration-slow ease-standard',
              isComplete
                ? 'bg-success'
                : percentage >= 75
                ? 'bg-accent'
                : 'bg-black dark:bg-white',
              celebrated && 'animate-celebrate',
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* MOQ marker at 100% — always at the end */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-surface-4"
          aria-hidden="true"
        />

        {/* Stretch goal marker */}
        {stretchGoal && backerCount >= moq && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent"
            style={{ left: `${Math.min(100, (moq / stretchGoal) * 100)}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Footer: days remaining + social proof */}
      <div className="flex items-center justify-between gap-2">
        {/* MOQ reached badge */}
        {isComplete ? (
          <span className={cn(
            'flex items-center gap-1.5 text-sm font-semibold text-success font-body',
            celebrated && 'animate-spring-in',
          )}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
              <path d="M4.5 8L7 10.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Campaign funded!
          </span>
        ) : daysLeft !== undefined ? (
          <span className={cn(
            'text-sm font-body',
            daysLeft <= 3 ? 'text-warning font-semibold' : 'text-text-secondary',
          )}>
            {daysLeft === 0 ? 'Ends today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
          </span>
        ) : (
          <span />
        )}

        {/* Social proof */}
        {showSocialProof && recentBacker && (
          <span className="text-xs text-text-secondary font-body truncate max-w-[180px]">
            🛍 {recentBacker} just backed
          </span>
        )}
      </div>
    </div>
  );
}
