'use client';

/**
 * Checkbox — custom styled checkbox with checkmark animation.
 * Supports indeterminate state.
 */

import React, { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  error?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, error, indeterminate, className, disabled, id, ...props }, ref) => {
    const checkboxId = id ?? `checkbox-${Math.random().toString(36).slice(2)}`;

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-start gap-3 cursor-pointer select-none',
          'min-h-touch',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {/* Hidden input */}
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />

        {/* Custom checkbox box */}
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex-shrink-0 w-5 h-5 rounded-sm',
            'border-2 border-surface-3',
            'transition-all duration-fast ease-standard',
            'bg-transparent',
            'peer-checked:bg-black peer-checked:border-black',
            'dark:peer-checked:bg-white dark:peer-checked:border-white',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2',
            error && 'border-error peer-checked:bg-error peer-checked:border-error',
            'flex items-center justify-center',
          )}
        >
          {/* Checkmark SVG */}
          <svg
            width="12" height="9"
            viewBox="0 0 12 9"
            fill="none"
            className={cn(
              'transition-opacity duration-fast',
              'opacity-0 peer-checked:opacity-100',
            )}
            aria-hidden
          >
            {indeterminate ? (
              <line x1="1" y1="4.5" x2="11" y2="4.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path
                d="M1 4.5L4.5 8L11 1"
                stroke="white"
                className="dark:[stroke:black]"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </span>

        {/* Text */}
        {(label || hint) && (
          <span className="flex flex-col">
            {label && (
              <span className="text-base text-text-primary font-body leading-normal">
                {label}
              </span>
            )}
            {hint && (
              <span className="text-sm text-text-secondary font-body">
                {hint}
              </span>
            )}
            {error && (
              <span className="text-sm text-error font-body" role="alert">
                {error}
              </span>
            )}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
