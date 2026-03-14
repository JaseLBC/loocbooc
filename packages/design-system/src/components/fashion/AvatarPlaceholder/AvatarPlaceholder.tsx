'use client';

/**
 * AvatarPlaceholder — beautiful empty state enticing avatar creation.
 * The first thing a new user sees where their avatar will be.
 */

import React from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../../primitives/Button';

export interface AvatarPlaceholderProps {
  onCreateAvatar?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Show without the CTA (e.g. inside a product card) */
  compact?: boolean;
  className?: string;
}

const sizeClasses = {
  sm:   'w-20 h-20',
  md:   'w-40 h-40',
  lg:   'w-64 h-64',
  full: 'w-full aspect-square',
};

export function AvatarPlaceholder({
  onCreateAvatar,
  size = 'md',
  compact = false,
  className,
}: AvatarPlaceholderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-6',
        compact && 'gap-2',
        className,
      )}
    >
      {/* The illustration */}
      <div
        className={cn(
          'relative flex items-center justify-center',
          'rounded-full overflow-hidden',
          'bg-gradient-to-b from-accent/10 to-accent/20',
          sizeClasses[size],
        )}
        aria-hidden="true"
      >
        {/* Silhouette */}
        <svg
          viewBox="0 0 200 200"
          fill="none"
          className="w-3/4 h-3/4"
          aria-hidden
        >
          {/* Head */}
          <circle cx="100" cy="60" r="28" fill="currentColor" opacity="0.12" />
          <circle cx="100" cy="60" r="22" fill="currentColor" opacity="0.08" />
          {/* Body */}
          <path
            d="M55 145c0-28 20-42 45-42s45 14 45 42"
            fill="currentColor"
            opacity="0.10"
          />
          {/* Decorative sparkle dots */}
          <circle cx="145" cy="45" r="5" fill="currentColor" opacity="0.20" />
          <circle cx="152" cy="58" r="3" fill="currentColor" opacity="0.15" />
          <circle cx="140" cy="62" r="2" fill="currentColor" opacity="0.12" />
          <circle cx="55" cy="48" r="4" fill="currentColor" opacity="0.15" />
          <circle cx="48" cy="60" r="2.5" fill="currentColor" opacity="0.12" />
          {/* Measurement lines hint */}
          <line x1="70" y1="82" x2="130" y2="82" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" opacity="0.15" />
          <line x1="75" y1="96" x2="125" y2="96" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" opacity="0.12" />
        </svg>

        {/* Plus icon in bottom-right if compact */}
        {compact && onCreateAvatar && (
          <button
            type="button"
            onClick={onCreateAvatar}
            aria-label="Create your avatar"
            className={cn(
              'absolute bottom-1 right-1',
              'w-8 h-8 rounded-full',
              'bg-black text-white dark:bg-white dark:text-black',
              'flex items-center justify-center',
              'shadow-2',
              'transition-transform duration-fast ease-spring',
              'hover:scale-110',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Text + CTA */}
      {!compact && (
        <div className="flex flex-col items-center text-center gap-3 max-w-xs">
          <h3 className="text-lg font-semibold text-text-primary font-body">
            Your avatar lives here
          </h3>
          <p className="text-sm text-text-secondary font-body leading-relaxed">
            Create your Loocbooc avatar and see exactly how clothes will fit — before you buy.
          </p>
          {onCreateAvatar && (
            <Button
              variant="primary"
              size="md"
              onClick={onCreateAvatar}
            >
              Create My Avatar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
