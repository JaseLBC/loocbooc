'use client';

import { useEffect, useRef, useState } from 'react';

interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

interface UseSpringOptions {
  from: number;
  to: number;
  config?: SpringConfig;
  delay?: number;
  onComplete?: () => void;
}

/**
 * useSpring — animates a numeric value using spring physics.
 * Useful for progress bars, counters, and dimension animations.
 *
 * @example
 * const value = useSpring({ from: 0, to: 75 });
 * // value animates from 0 → 75 with spring easing
 */
export function useSpring({
  from,
  to,
  config = {},
  delay = 0,
  onComplete,
}: UseSpringOptions): number {
  const { stiffness = 170, damping = 26, mass = 1 } = config;
  const [value, setValue] = useState(from);
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    // Respect reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(to);
      onComplete?.();
      return;
    }

    let pos = from;
    let velocity = 0;
    let started = false;

    const timer = setTimeout(() => {
      started = true;
      const step = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;

        const dt = Math.min((timestamp - (startTimeRef.current ?? timestamp)) / 1000, 0.064);
        startTimeRef.current = timestamp;

        // Spring integration
        const springForce = -stiffness * (pos - to);
        const dampingForce = -damping * velocity;
        const acceleration = (springForce + dampingForce) / mass;

        velocity += acceleration * dt;
        pos += velocity * dt;

        // Settle check
        const atRest = Math.abs(pos - to) < 0.01 && Math.abs(velocity) < 0.01;
        if (atRest) {
          setValue(to);
          onComplete?.();
          return;
        }

        setValue(pos);
        rafRef.current = requestAnimationFrame(step);
      };

      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [from, to, stiffness, damping, mass, delay, onComplete]);

  return value;
}
