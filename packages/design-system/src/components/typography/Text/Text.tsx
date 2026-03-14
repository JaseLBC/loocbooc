/**
 * Text — body / caption / label / overline variants.
 */

import React, { type HTMLAttributes } from 'react';
import { cn } from '../../../utils/cn';

export type TextVariant = 'body' | 'caption' | 'label' | 'overline';
export type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'error' | 'success' | 'warning';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  color?: TextColor;
  /** Render as a different element */
  as?: 'p' | 'span' | 'div' | 'small' | 'strong' | 'em';
  /** Text truncation */
  truncate?: boolean;
  /** Line clamp */
  clamp?: 1 | 2 | 3;
}

const variantClasses: Record<TextVariant, string> = {
  body:     'text-base leading-normal font-regular',
  caption:  'text-sm leading-snug font-regular',
  label:    'text-sm leading-normal font-medium',
  overline: 'text-xs leading-normal font-semibold tracking-wider uppercase',
};

const colorClasses: Record<TextColor, string> = {
  primary:   'text-text-primary',
  secondary: 'text-text-secondary',
  tertiary:  'text-text-tertiary',
  inverse:   'text-text-inverse',
  error:     'text-error',
  success:   'text-success',
  warning:   'text-warning',
};

export function Text({
  variant = 'body',
  color = 'primary',
  as: Tag = 'p',
  truncate,
  clamp,
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(
        'font-body',
        variantClasses[variant],
        colorClasses[color],
        truncate && 'truncate',
        clamp === 1 && 'line-clamp-1',
        clamp === 2 && 'line-clamp-2',
        clamp === 3 && 'line-clamp-3',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
