'use client';

/**
 * SizeSelector — pill-based size selection.
 * Selected: bold + filled.
 * Unavailable: struck through.
 * Keyboard navigable (arrow keys).
 */

import React, { useCallback } from 'react';
import { cn } from '../../../utils/cn';

export interface SizeOption {
  value: string;
  label: string;
  available?: boolean;
  /** Highlight as recommended (from avatar fit data) */
  recommended?: boolean;
}

export interface SizeSelectorProps {
  sizes: SizeOption[];
  value?: string;
  onChange?: (size: string) => void;
  label?: string;
  className?: string;
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  label,
  className,
}: SizeSelectorProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const availableSizes = sizes.filter((s) => s.available !== false);
      const currentAvailIndex = availableSizes.findIndex((s) => s.value === sizes[index].value);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = availableSizes[currentAvailIndex + 1];
        if (next) onChange?.(next.value);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = availableSizes[currentAvailIndex - 1];
        if (prev) onChange?.(prev.value);
      }
    },
    [sizes, onChange]
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary font-body">
            {label}
          </span>
          {value && (
            <span className="text-sm text-text-secondary font-body">
              {sizes.find((s) => s.value === value)?.label ?? value}
            </span>
          )}
        </div>
      )}

      <div
        role="group"
        aria-label={label ?? 'Size selection'}
        className="flex flex-wrap gap-2"
      >
        {sizes.map((size, index) => {
          const isSelected = size.value === value;
          const isAvailable = size.available !== false;

          return (
            <button
              key={size.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Size ${size.label}${!isAvailable ? ', unavailable' : ''}${size.recommended ? ', recommended for you' : ''}`}
              disabled={!isAvailable}
              onClick={() => isAvailable && onChange?.(size.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'relative min-w-[44px] min-h-touch px-3',
                'flex items-center justify-center',
                'text-sm font-body rounded-full',
                'transition-all duration-fast ease-standard',
                'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                // Selected
                isSelected && isAvailable && [
                  'bg-black text-white dark:bg-white dark:text-black',
                  'font-bold',
                  'shadow-1',
                ],
                // Available, not selected
                !isSelected && isAvailable && [
                  'border border-surface-3 bg-transparent',
                  'text-text-primary',
                  'hover:border-surface-4 hover:bg-surface-2',
                ],
                // Unavailable
                !isAvailable && [
                  'border border-surface-3 bg-transparent',
                  'text-text-tertiary cursor-not-allowed',
                  'line-through decoration-text-tertiary',
                ],
                // Recommended indicator
                size.recommended && !isSelected && isAvailable && 'border-accent',
              )}
            >
              {size.label}
              {/* Recommended dot */}
              {size.recommended && !isSelected && isAvailable && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Recommended label */}
      {sizes.some((s) => s.recommended) && (
        <p className="text-xs text-text-secondary font-body">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" aria-hidden />
            Your recommended size
          </span>
        </p>
      )}
    </div>
  );
}
