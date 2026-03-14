'use client';

/**
 * ProgressBar — smooth animated fill.
 * Used for Back It MOQ progress, file uploads, multi-step flows.
 */

import React, { useEffect, useRef, type HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error' | 'accent';
export type ProgressBarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  max?: number;
  variant?: ProgressBarVariant;
  size?: ProgressBarSize;
  /** Show value label */
  showLabel?: boolean;
  label?: string;
  /** Animate on mount */
  animated?: boolean;
}

const variantClasses: Record<ProgressBarVariant, string> = {
  default: 'bg-black dark:bg-white',
  success: 'bg-success',
  warning: 'bg-warning',
  error:   'bg-error',
  accent:  'bg-accent',
};

const sizeClasses: Record<ProgressBarSize, string> = {
  xs: 'h-1 rounded-full',
  sm: 'h-1.5 rounded-full',
  md: 'h-2 rounded-full',
  lg: 'h-3 rounded-full',
};

export function ProgressBar({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  animated = true,
  className,
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !animated) {
      fill.style.width = `${percentage}%`;
      return;
    }

    // Animate smoothly
    fill.style.transition = 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)';
    fill.style.width = `${percentage}%`;
  }, [percentage, animated]);

  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      {(label || showLabel) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <span className="text-sm font-medium text-text-primary font-body">
              {label}
            </span>
          )}
          {showLabel && (
            <span className="text-sm text-text-secondary font-body tabular-nums">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `${Math.round(percentage)}% complete`}
        className={cn(
          'w-full bg-surface-3 overflow-hidden',
          sizeClasses[size],
        )}
      >
        <div
          ref={fillRef}
          className={cn(
            'h-full rounded-full',
            variantClasses[variant],
          )}
          style={{ width: animated ? '0%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
