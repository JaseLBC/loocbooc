/**
 * Card — elevation-based surface (not border-based, per design principles).
 * Hover lifts. No decorative borders.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export type CardElevation = 0 | 1 | 2 | 3 | 4;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  /** Hover increases elevation */
  hoverable?: boolean;
  /** Full-bleed content (removes padding) */
  noPadding?: boolean;
  /** Clickable card — adds cursor-pointer and role="button" semantics */
  clickable?: boolean;
  children: ReactNode;
}

const elevationClasses: Record<CardElevation, string> = {
  0: 'shadow-none',
  1: 'shadow-1',
  2: 'shadow-2',
  3: 'shadow-3',
  4: 'shadow-4',
};

export function Card({
  elevation = 1,
  hoverable = false,
  noPadding = false,
  clickable = false,
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={cn(
        'rounded-lg bg-surface-1',
        'transition-shadow duration-normal ease-standard',
        elevationClasses[elevation],
        hoverable && [
          'hover:shadow-3',
          elevation === 0 && 'hover:shadow-1',
          elevation === 1 && 'hover:shadow-2',
          elevation === 2 && 'hover:shadow-3',
          elevation >= 3 && 'hover:shadow-4',
        ],
        hoverable && 'transition-all hover:-translate-y-0.5',
        clickable && 'cursor-pointer',
        clickable && 'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 outline-none',
        !noPadding && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
