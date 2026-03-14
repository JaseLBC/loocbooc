/**
 * ErrorState — plain English, recovery action.
 * Never show technical error messages to users.
 */

import React, { type ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export type ErrorStateVariant = 'generic' | 'network' | 'notFound' | 'permission' | 'payment';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  variant?: ErrorStateVariant;
  className?: string;
  /** Raw error for dev — never shown to users */
  devError?: unknown;
}

const defaults: Record<ErrorStateVariant, { title: string; description: string }> = {
  generic: {
    title: 'Something went wrong',
    description: "We hit a snag. It's on us, not you. Try again in a moment.",
  },
  network: {
    title: 'No connection',
    description: 'Check your internet connection and try again.',
  },
  notFound: {
    title: "We can't find that",
    description: 'This page or item may have been moved or removed.',
  },
  permission: {
    title: "You don't have access",
    description: "You don't have permission to view this. Contact your team admin if you think this is wrong.",
  },
  payment: {
    title: 'Payment failed',
    description: 'Your payment didn\'t go through. Check your details and try again. Nothing was charged.',
  },
};

// Simple but clear error illustration
function ErrorIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
      <circle cx="40" cy="40" r="32" fill="currentColor" opacity="0.06" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.06" />
      {/* Exclamation */}
      <rect x="37" y="24" width="6" height="20" rx="3" fill="currentColor" opacity="0.25" />
      <circle cx="40" cy="52" r="4" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

export function ErrorState({
  title,
  description,
  action,
  variant = 'generic',
  className,
  devError,
}: ErrorStateProps) {
  const def = defaults[variant];
  const displayTitle = title ?? def.title;
  const displayDesc  = description ?? def.description;

  // Log dev error to console without showing it to users
  if (devError && process.env.NODE_ENV !== 'production') {
    console.error('[ErrorState]', devError);
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center',
        'text-center py-12 px-6',
        className,
      )}
    >
      <div className="mb-6 text-error">
        <ErrorIllustration />
      </div>

      <h3 className="text-lg font-semibold text-text-primary font-body mb-2">
        {displayTitle}
      </h3>

      <p className="text-sm text-text-secondary font-body leading-relaxed max-w-sm mb-6">
        {displayDesc}
      </p>

      {action && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {action}
        </div>
      )}
    </div>
  );
}
