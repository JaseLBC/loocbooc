'use client';

/**
 * NumberTicker — animates a numeric value change.
 * Used for live backing counts, MOQ progress, campaign stats.
 *
 * @example
 * <NumberTicker value={backingCount} />
 * <NumberTicker value={percentage} suffix="%" decimals={1} />
 */

import React, { useEffect, useRef, useState } from 'react';

interface NumberTickerProps {
  value: number;
  /** Duration of animation (ms) */
  duration?: number;
  /** Decimal places */
  decimals?: number;
  /** Text before the number */
  prefix?: string;
  /** Text after the number */
  suffix?: string;
  /** Custom formatter */
  format?: (value: number) => string;
  /** Locale for number formatting */
  locale?: string;
  className?: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function NumberTicker({
  value,
  duration = 600,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  locale = 'en-AU',
  className,
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(value);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || value === prevValueRef.current) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    startValueRef.current = prevValueRef.current;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      const current = lerp(startValueRef.current, value, eased);

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        prevValueRef.current = value;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = format
    ? format(displayValue)
    : displayValue.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span
      className={className}
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${prefix}${value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`}
    >
      {prefix}{formatted}{suffix}
    </span>
  );
}
