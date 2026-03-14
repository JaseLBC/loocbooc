/**
 * EmptyState — never just blank. Always has: illustration, title, description, CTA.
 * Per design principles: "Every empty state tells a story."
 */

import React, { type ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export type EmptyStateVariant =
  | 'default'
  | 'search'
  | 'campaigns'
  | 'garments'
  | 'orders'
  | 'backers'
  | 'stylists'
  | 'avatar';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Custom illustration override */
  illustration?: ReactNode;
  variant?: EmptyStateVariant;
  /** Size of the illustration */
  illustrationSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Minimal but beautiful SVG illustrations
const illustrations: Record<EmptyStateVariant, ReactNode> = {
  default: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="20" y="20" width="80" height="50" rx="8" fill="currentColor" opacity="0.07" />
      <rect x="35" y="32" width="50" height="6" rx="3" fill="currentColor" opacity="0.15" />
      <rect x="35" y="45" width="35" height="6" rx="3" fill="currentColor" opacity="0.10" />
      <circle cx="60" cy="10" r="6" fill="currentColor" opacity="0.12" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="52" cy="38" r="22" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <line x1="68" y1="55" x2="88" y2="68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.20" />
      <line x1="44" y1="34" x2="60" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
      <line x1="44" y1="41" x2="56" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.20" />
    </svg>
  ),
  campaigns: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="15" y="25" width="40" height="50" rx="4" fill="currentColor" opacity="0.07" />
      <rect x="65" y="15" width="40" height="50" rx="4" fill="currentColor" opacity="0.10" />
      <rect x="22" y="32" width="26" height="4" rx="2" fill="currentColor" opacity="0.20" />
      <rect x="22" y="42" width="20" height="4" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="72" y="22" width="26" height="4" rx="2" fill="currentColor" opacity="0.20" />
      <rect x="72" y="32" width="20" height="4" rx="2" fill="currentColor" opacity="0.15" />
      {/* Progress bar */}
      <rect x="22" y="55" width="26" height="3" rx="1.5" fill="currentColor" opacity="0.10" />
      <rect x="22" y="55" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.30" />
      <rect x="72" y="46" width="26" height="3" rx="1.5" fill="currentColor" opacity="0.10" />
      <rect x="72" y="46" width="22" height="3" rx="1.5" fill="currentColor" opacity="0.30" />
    </svg>
  ),
  garments: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Simplified t-shirt shape */}
      <path d="M38 18l-20 12 8 4v28h48V34l8-4L62 18c-2 6-6 8-12 8s-10-2-12-8z" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.15" strokeLinejoin="round" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="25" y="15" width="70" height="55" rx="6" fill="currentColor" opacity="0.07" />
      <rect x="35" y="28" width="14" height="14" rx="3" fill="currentColor" opacity="0.12" />
      <rect x="57" y="30" width="28" height="4" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="57" y="38" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.10" />
      <line x1="35" y1="54" x2="85" y2="54" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" opacity="0.15" />
      <rect x="35" y="60" width="30" height="4" rx="2" fill="currentColor" opacity="0.12" />
      <rect x="71" y="60" width="14" height="4" rx="2" fill="currentColor" opacity="0.15" />
    </svg>
  ),
  backers: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="45" cy="32" r="12" fill="currentColor" opacity="0.10" />
      <circle cx="75" cy="32" r="12" fill="currentColor" opacity="0.08" />
      <circle cx="60" cy="28" r="14" fill="currentColor" opacity="0.12" />
      <rect x="25" y="52" width="70" height="4" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="38" y="52" width="44" height="4" rx="2" fill="currentColor" opacity="0.18" />
    </svg>
  ),
  stylists: (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="60" cy="28" r="14" fill="currentColor" opacity="0.10" />
      <path d="M35 65c0-14 11-22 25-22s25 8 25 22" fill="currentColor" opacity="0.07" />
      <circle cx="60" cy="28" r="8" fill="currentColor" opacity="0.12" />
      {/* Star/sparkle */}
      <path d="M90 18l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" fill="currentColor" opacity="0.20" />
    </svg>
  ),
  avatar: (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Silhouette */}
      <ellipse cx="60" cy="28" rx="14" ry="16" fill="currentColor" opacity="0.10" />
      <path d="M30 90c0-20 13-32 30-32s30 12 30 32" fill="currentColor" opacity="0.07" />
      {/* Body shape hint */}
      <ellipse cx="60" cy="28" rx="8" ry="10" fill="currentColor" opacity="0.12" />
      {/* Sparkle/magic dots */}
      <circle cx="88" cy="20" r="3" fill="currentColor" opacity="0.20" />
      <circle cx="94" cy="30" r="2" fill="currentColor" opacity="0.15" />
      <circle cx="85" cy="35" r="1.5" fill="currentColor" opacity="0.12" />
      <circle cx="28" cy="22" r="2.5" fill="currentColor" opacity="0.15" />
      <circle cx="22" cy="32" r="2" fill="currentColor" opacity="0.12" />
    </svg>
  ),
};

const illustrationSizeClasses = {
  sm: 'w-24 h-16',
  md: 'w-36 h-24',
  lg: 'w-48 h-32',
};

export function EmptyState({
  title,
  description,
  action,
  illustration,
  variant = 'default',
  illustrationSize = 'md',
  className,
}: EmptyStateProps) {
  const ill = illustration ?? illustrations[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'text-center py-12 px-6',
        className,
      )}
    >
      {/* Illustration */}
      {ill && (
        <div
          className={cn(
            'mb-6 text-text-primary',
            illustrationSizeClasses[illustrationSize],
          )}
        >
          {ill}
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-text-primary font-body mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-secondary font-body leading-relaxed max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* CTA */}
      {action && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {action}
        </div>
      )}
    </div>
  );
}
