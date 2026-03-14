/**
 * Code — monospace for measurements, codes, technical data.
 * Uses JetBrains Mono.
 */

import React, { type HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export type CodeVariant = 'inline' | 'block';

export interface CodeProps extends HTMLAttributes<HTMLElement> {
  variant?: CodeVariant;
}

export function Code({
  variant = 'inline',
  className,
  children,
  ...props
}: CodeProps) {
  if (variant === 'block') {
    return (
      <pre
        className={cn(
          'font-mono text-sm text-text-primary',
          'bg-surface-2 rounded-lg p-4',
          'overflow-x-auto',
          'leading-relaxed',
          className,
        )}
        {...props}
      >
        <code>{children}</code>
      </pre>
    );
  }

  return (
    <code
      className={cn(
        'font-mono text-sm text-text-primary',
        'bg-surface-2 rounded px-1.5 py-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
