'use client';

/**
 * PageTransition — wraps route content for smooth page-to-page transitions.
 * Works with Next.js App Router.
 *
 * @example
 * // In app/layout.tsx:
 * <PageTransition key={pathname}>
 *   {children}
 * </PageTransition>
 */

import React, { useEffect, useState, type ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  /** Transition type */
  variant?: 'fade' | 'slide-up' | 'none';
  /** Duration in ms */
  duration?: number;
  className?: string;
}

export function PageTransition({
  children,
  variant = 'fade',
  duration = 300,
  className = '',
}: PageTransitionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (variant === 'none' || prefersReduced) {
    return <>{children}</>;
  }

  const transitions: Record<string, { from: React.CSSProperties; to: React.CSSProperties }> = {
    'fade': {
      from: { opacity: 0 },
      to:   { opacity: 1 },
    },
    'slide-up': {
      from: { opacity: 0, transform: 'translateY(20px)' },
      to:   { opacity: 1, transform: 'translateY(0)' },
    },
  };

  const t = transitions[variant] ?? transitions.fade;

  const style: React.CSSProperties = {
    ...(mounted ? t.to : t.from),
    transition: `opacity ${duration}ms cubic-bezier(0, 0, 0.2, 1), transform ${duration}ms cubic-bezier(0, 0, 0.2, 1)`,
  };

  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
