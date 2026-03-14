/**
 * Badge — status indicator.
 * Variants: success | warning | error | info | neutral
 * Sizes: sm | md
 */

import React, { type ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Optional dot indicator */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success border border-success-border',
  warning: 'bg-warning-bg text-warning border border-warning-border',
  error:   'bg-error-bg text-error border border-error-border',
  info:    'bg-info-bg text-info border border-info-border',
  neutral: 'bg-surface-2 text-text-secondary border border-surface-3',
  accent:  'bg-accent/10 text-accent-dark border border-accent/20',
};

const dotClasses: Record<BadgeVariant, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error:   'bg-error',
  info:    'bg-info',
  neutral: 'bg-text-tertiary',
  accent:  'bg-accent',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
};

export function Badge({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium font-body rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full shrink-0',
            size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
            dotClasses[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}
