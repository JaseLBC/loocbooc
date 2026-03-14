'use client';

import { useEffect, useRef, useState } from 'react';

interface UseFadeInOptions {
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Duration of the fade (ms) */
  duration?: number;
  /** Only animate when element enters the viewport */
  onScroll?: boolean;
  /** IntersectionObserver threshold (0–1) */
  threshold?: number;
}

interface FadeInResult {
  ref: React.RefObject<HTMLElement>;
  style: React.CSSProperties;
  isVisible: boolean;
}

/**
 * useFadeIn — fades an element in on mount or scroll entry.
 *
 * @example
 * const { ref, style } = useFadeIn({ delay: 100 });
 * return <div ref={ref} style={style}>...</div>
 */
export function useFadeIn(options: UseFadeInOptions = {}): FadeInResult {
  const {
    delay = 0,
    duration = 350,
    onScroll = false,
    threshold = 0.1,
  } = options;

  const ref = useRef<HTMLElement>(null!);
  const [isVisible, setIsVisible] = useState(!onScroll);

  useEffect(() => {
    // Respect reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }

    if (!onScroll) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timer = setTimeout(() => setIsVisible(true), delay);
          observer.unobserve(el);
          return () => clearTimeout(timer);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, onScroll, threshold]);

  const style: React.CSSProperties = {
    opacity:    isVisible ? 1 : 0,
    transform:  isVisible ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity ${duration}ms cubic-bezier(0, 0, 0.2, 1), transform ${duration}ms cubic-bezier(0, 0, 0.2, 1)`,
    transitionDelay: !onScroll ? `${delay}ms` : '0ms',
  };

  return { ref, style, isVisible };
}
