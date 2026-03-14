'use client';

/**
 * Toggle — animated on/off switch.
 * Apple-style sliding toggle. 44px touch target.
 */

import React, { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export interface ToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  /** Helper text */
  hint?: string;
  size?: 'sm' | 'md';
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, hint, size = 'md', className, disabled, id, ...props }, ref) => {
    const toggleId = id ?? `toggle-${Math.random().toString(36).slice(2)}`;

    const trackSize = size === 'sm'
      ? 'w-9 h-5'
      : 'w-12 h-7';
    const thumbSize = size === 'sm'
      ? 'w-4 h-4 translate-x-0.5 peer-checked:translate-x-[17px]'
      : 'w-6 h-6 translate-x-0.5 peer-checked:translate-x-[21px]';

    return (
      <label
        htmlFor={toggleId}
        className={cn(
          'inline-flex items-center gap-3 cursor-pointer select-none',
          'min-h-touch',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {/* Hidden input */}
        <input
          ref={ref}
          id={toggleId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />

        {/* Track */}
        <span
          aria-hidden="true"
          className={cn(
            'relative flex-shrink-0 rounded-full',
            'transition-colors duration-normal ease-standard',
            'bg-surface-3 peer-checked:bg-black dark:peer-checked:bg-white',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2',
            trackSize,
          )}
        >
          {/* Thumb */}
          <span
            className={cn(
              'absolute top-1/2 -translate-y-1/2',
              'rounded-full bg-white dark:bg-black shadow-1',
              'transition-transform duration-normal ease-spring',
              thumbSize,
            )}
          />
        </span>

        {/* Label + hint */}
        {(label || hint) && (
          <span className="flex flex-col">
            {label && (
              <span className="text-base font-medium text-text-primary font-body">
                {label}
              </span>
            )}
            {hint && (
              <span className="text-sm text-text-secondary font-body">
                {hint}
              </span>
            )}
          </span>
        )}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
