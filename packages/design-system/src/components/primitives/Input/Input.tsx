'use client';

/**
 * Input — Loocbooc text input with floating label animation.
 * - Floating label rises on focus or when value is present
 * - Clear button when clearable prop is set
 * - All states: default, focused, filled, error, disabled
 * - 44px min touch target for mobile
 * - Full dark mode
 */

import React, {
  forwardRef,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../../utils/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  /** Error message — if present, shows error styling */
  error?: string;
  /** Helper text below the input */
  hint?: string;
  /** Show clear button when input has value */
  clearable?: boolean;
  /** Icon inside left side */
  iconLeft?: ReactNode;
  /** Icon inside right side (replaced by clear button if clearable) */
  iconRight?: ReactNode;
  /** Called when clear button is tapped */
  onClear?: () => void;
  /** Full-width */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      clearable = false,
      iconLeft,
      iconRight,
      onClear,
      fullWidth = false,
      className,
      id: idProp,
      value,
      defaultValue,
      disabled,
      readOnly,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const hintId  = `${id}-hint`;

    const [isFocused, setIsFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');

    // Determine if the input has a value (for floating label position)
    const hasValue = Boolean(
      value !== undefined ? value : internalValue
    );
    const isFloating = isFocused || hasValue;

    const hasError = Boolean(error);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) setInternalValue(e.target.value);
      onChange?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleClear = () => {
      setInternalValue('');
      onClear?.();
    };

    const showClear = clearable && hasValue && !disabled && !readOnly;

    return (
      <div className={cn('flex flex-col gap-1', fullWidth ? 'w-full' : 'w-auto', className)}>
        {/* Input wrapper */}
        <div
          className={cn(
            'relative flex items-center',
            'min-h-touch',
            'rounded-md border',
            'bg-surface-2 dark:bg-surface-2',
            'transition-all duration-fast ease-standard',
            // Border states
            hasError
              ? 'border-error'
              : isFocused
              ? 'border-black dark:border-white shadow-focus'
              : 'border-surface-3 hover:border-surface-4',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {/* Left icon */}
          {iconLeft && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
              {iconLeft}
            </span>
          )}

          {/* Input element */}
          <input
            ref={ref}
            id={id}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            readOnly={readOnly}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-describedby={cn(hasError && errorId, hint && hintId) || undefined}
            aria-invalid={hasError}
            className={cn(
              'peer w-full h-full min-h-touch',
              'bg-transparent outline-none',
              'font-body text-base text-text-primary',
              'placeholder:text-transparent',  // hide native placeholder — use floating label
              // Horizontal padding accounts for icons
              iconLeft ? 'pl-10' : 'pl-3',
              showClear || iconRight ? 'pr-10' : 'pr-3',
              // Vertical padding with label room at top
              label ? 'pt-5 pb-1.5' : 'py-3',
              'disabled:cursor-not-allowed',
              'transition-all duration-fast ease-standard',
            )}
            {...props}
          />

          {/* Floating label */}
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'absolute left-3 pointer-events-none select-none',
                'font-body transition-all duration-fast ease-standard',
                iconLeft && 'left-10',
                isFloating
                  ? 'top-1.5 text-xs font-medium text-text-secondary'
                  : 'top-1/2 -translate-y-1/2 text-base text-text-secondary',
                isFocused && !hasError && 'text-black dark:text-white',
                hasError && 'text-error',
              )}
            >
              {label}
            </label>
          )}

          {/* Right: clear button or icon */}
          {showClear ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear input"
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                'w-6 h-6 rounded-full',
                'text-text-secondary hover:text-text-primary',
                'hover:bg-surface-3',
                'transition-colors duration-fast ease-standard',
              )}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : iconRight ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
              {iconRight}
            </span>
          ) : null}
        </div>

        {/* Error message */}
        {hasError && (
          <p id={errorId} role="alert" className="text-xs text-error font-medium pl-1">
            {error}
          </p>
        )}

        {/* Hint text */}
        {!hasError && hint && (
          <p id={hintId} className="text-xs text-text-secondary pl-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
