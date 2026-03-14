'use client';

/**
 * Loocbooc Theme Provider
 * - Detects system preference on first load
 * - Persists choice to localStorage
 * - Applies .dark class to <html> element (Tailwind dark mode)
 * - Provides useTheme() hook
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The user's explicit choice (light | dark | system) */
  theme: Theme;
  /** The actually rendered theme after system resolution */
  resolvedTheme: ResolvedTheme;
  /** Set the theme explicitly */
  setTheme: (theme: Theme) => void;
  /** Convenience toggle (light ↔ dark) */
  toggleTheme: () => void;
}

const STORAGE_KEY = 'loocbooc:theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme when no preference is stored */
  defaultTheme?: Theme;
  /** Storage key override */
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null;
      return stored ?? defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme)
  );

  // Apply on mount and when theme changes
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // localStorage not available — silent fail
    }
  }, [theme, storageKey]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'dark';
      // 'system' → determine based on current system and go opposite
      return getSystemTheme() === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}

/**
 * Inline script for <head> — prevents flash of wrong theme on initial load.
 * Add this as a <Script> or raw <script> before body renders.
 *
 * Usage in Next.js layout.tsx:
 *   import { ThemeScript } from '@loocbooc/design-system/theme'
 *   <head><ThemeScript /></head>
 */
export function ThemeScript({ storageKey = STORAGE_KEY }: { storageKey?: string }) {
  const script = `
(function() {
  try {
    var s = localStorage.getItem('${storageKey}');
    var t = s || 'system';
    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch(e) {}
})();
  `.trim();

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: safe inline script for SSR theme hydration
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
