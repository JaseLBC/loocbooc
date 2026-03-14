/**
 * Skeleton — shimmer loading placeholder.
 * Always matches the shape of the content it replaces.
 * Never show a spinner where a skeleton can work.
 */

import React, { type HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Shape variant */
  variant?: 'text' | 'rect' | 'circle' | 'rounded';
  width?: string | number;
  height?: string | number;
  /** Number of lines (text variant) */
  lines?: number;
  /** Last line is shorter */
  lastLineShorter?: boolean;
}

function SkeletonBase({
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden',
        'bg-surface-2 dark:bg-surface-3',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent',
        'before:animate-shimmer',
        'before:bg-[length:200%_100%]',
        className,
      )}
      style={style}
      {...props}
    />
  );
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  lines = 1,
  lastLineShorter = true,
  className,
  style,
  ...props
}: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;

  if (variant === 'circle') {
    const size = w ?? h ?? '40px';
    return (
      <SkeletonBase
        className={cn('rounded-full', className)}
        style={{ width: size, height: size, ...style }}
        {...props}
      />
    );
  }

  if (variant === 'text') {
    return (
      <div className={cn('flex flex-col gap-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => {
          const isLast = i === lines - 1;
          const lineWidth = isLast && lastLineShorter ? '70%' : (w ?? '100%');
          return (
            <SkeletonBase
              key={i}
              className="rounded-sm"
              style={{ width: lineWidth, height: h ?? '1em' }}
            />
          );
        })}
      </div>
    );
  }

  if (variant === 'rounded') {
    return (
      <SkeletonBase
        className={cn('rounded-lg', className)}
        style={{ width: w, height: h, ...style }}
        {...props}
      />
    );
  }

  // Default: rect
  return (
    <SkeletonBase
      className={cn('rounded-md', className)}
      style={{ width: w, height: h, ...style }}
      {...props}
    />
  );
}

// Convenience components for common patterns
export function SkeletonCard() {
  return (
    <div className="p-6 rounded-lg bg-surface-1 shadow-1 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" height={16} />
        </div>
      </div>
      <Skeleton variant="rect" height={160} className="w-full rounded-lg" />
      <Skeleton variant="text" lines={3} />
    </div>
  );
}

export function SkeletonGarmentCard() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton variant="rect" className="w-full aspect-[3/4] rounded-lg" />
      <Skeleton variant="text" lines={2} />
      <Skeleton width="40%" height={20} variant="rounded" />
    </div>
  );
}
