'use client';

/**
 * Button — Loocbooc primary interactive element.
 * Variants: primary | secondary | ghost | danger | accent
 * Sizes: sm | md | lg
 * States: default | hover | active | loading | disabled
 * - 44px minimum touch target on mobile (Apple HIG compliant)
 * - Keyboard navigable
 * - Loading spinner replaces children
 * - Full dark mode
 */

import React, {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Icon before label */
  iconLeft?: ReactNode;
  /** Icon after label */
  iconRight?: ReactNode;
  /** Full-width button */
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-interactive-primary text-interactive-primaryText',
    'hover:bg-interactive-primaryHover',
    'active:bg-interactive-primaryActive',
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'disabled:bg-surface-3 disabled:text-text-disabled disabled:cursor-not-allowed',
    'dark:bg-interactive-primary dark:text-interactive-primaryText',
  ].join(' '),

  secondary: [
    'bg-transparent text-interactive-secondary-text',
    'border border-interactive-secondaryBorder',
    'hover:bg-interactive-secondaryHover',
    'active:bg-interactive-secondaryActive',
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'disabled:border-surface-3 disabled:text-text-disabled disabled:cursor-not-allowed',
  ].join(' '),

  ghost: [
    'bg-transparent text-text-primary',
    'hover:bg-[rgba(10,10,10,0.06)] dark:hover:bg-[rgba(250,250,250,0.06)]',
    'active:bg-[rgba(10,10,10,0.10)] dark:active:bg-[rgba(250,250,250,0.10)]',
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'disabled:text-text-disabled disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-interactive-danger text-interactive-dangerText',
    'hover:bg-interactive-dangerHover',
    'active:bg-error',
    'focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2',
    'disabled:bg-surface-3 disabled:text-text-disabled disabled:cursor-not-allowed',
  ].join(' '),

  accent: [
    'bg-accent text-white',
    'hover:bg-accent-dark',
    'active:bg-accent-dark',
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'disabled:bg-surface-3 disabled:text-text-disabled disabled:cursor-not-allowed',
  ].join(' '),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 min-h-touch px-3 text-sm gap-1.5 rounded-md',
  md: 'h-11 min-h-touch px-4 text-base gap-2 rounded-md',
  lg: 'h-12 min-h-touch px-6 text-lg gap-2.5 rounded-md',
};

// Loading spinner
function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 14 : size === 'md' ? 16 : 20;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="31.4"
        strokeDashoffset="10"
        opacity="0.3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      children,
      className,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={cn(
          // Base
          'inline-flex items-center justify-center',
          'font-body font-medium',
          'select-none outline-none',
          'transition-all duration-fast ease-standard',
          'cursor-pointer',
          // Touch target (invisible padding on small sizes)
          'relative',
          // Variants
          variantClasses[variant],
          // Size
          sizeClasses[size],
          // Full width
          fullWidth && 'w-full',
          // Loading state
          loading && 'cursor-wait',
          className
        )}
        {...props}
      >
        {/* Loading state replaces icons, content dims */}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner size={size} />
          </span>
        )}

        <span className={cn('flex items-center gap-inherit', loading && 'invisible')}>
          {iconLeft && <span aria-hidden="true" className="shrink-0">{iconLeft}</span>}
          {children && <span>{children}</span>}
          {iconRight && <span aria-hidden="true" className="shrink-0">{iconRight}</span>}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
