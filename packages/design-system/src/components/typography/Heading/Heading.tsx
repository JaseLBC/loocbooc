/**
 * Heading — h1–h6 with correct typography scale.
 * Uses DM Serif Display for larger sizes, Inter for smaller.
 */

import React, { type HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingFont = 'display' | 'body';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  /** Visual size override (defaults to level) */
  size?: HeadingLevel;
  /** Font family */
  font?: HeadingFont;
}

const levelDefaults: Record<HeadingLevel, { font: HeadingFont; classes: string }> = {
  1: { font: 'display', classes: 'text-5xl font-bold leading-tight tracking-tight' },
  2: { font: 'display', classes: 'text-4xl font-bold leading-tight tracking-tight' },
  3: { font: 'body',    classes: 'text-3xl font-semibold leading-tight tracking-tight' },
  4: { font: 'body',    classes: 'text-2xl font-semibold leading-snug' },
  5: { font: 'body',    classes: 'text-xl font-semibold leading-snug' },
  6: { font: 'body',    classes: 'text-lg font-semibold leading-snug' },
};

const sizeOverrides: Record<HeadingLevel, string> = {
  1: 'text-5xl leading-tight tracking-tight',
  2: 'text-4xl leading-tight tracking-tight',
  3: 'text-3xl leading-tight tracking-tight',
  4: 'text-2xl leading-snug',
  5: 'text-xl leading-snug',
  6: 'text-lg leading-snug',
};

const Tag: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
  1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6',
};

export function Heading({
  level = 2,
  size,
  font,
  className,
  children,
  ...props
}: HeadingProps) {
  const def = levelDefaults[level];
  const resolvedFont = font ?? def.font;
  const sizeClass = size ? sizeOverrides[size] : def.classes;

  const H = Tag[level];

  return (
    <H
      className={cn(
        'text-text-primary',
        resolvedFont === 'display' ? 'font-display' : 'font-body',
        sizeClass,
        className,
      )}
      {...props}
    >
      {children}
    </H>
  );
}
