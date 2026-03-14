/**
 * Loocbooc — Tailwind Configuration
 * Every value maps to a design token. No raw values in components.
 * Benchmark: Apple iOS precision.
 */

import type { Config } from 'tailwindcss';
import { tokens } from '@loocbooc/design-system/tokens';

const config: Config = {
  darkMode: 'class',   // .dark on <html> via ThemeProvider
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],

  theme: {
    // ─── Containers ────────────────────────────────────────────
    screens: {
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },

    // ─── Colours ───────────────────────────────────────────────
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      // Brand
      black:  tokens.colors.brand.black,
      white:  tokens.colors.brand.white,
      accent: {
        DEFAULT: tokens.colors.brand.accent,
        light:   tokens.colors.brand.accentLight,
        dark:    tokens.colors.brand.accentDark,
      },

      // Semantic
      success: {
        DEFAULT: tokens.colors.semantic.success,
        bg:      tokens.colors.semantic.successBg,
        border:  tokens.colors.semantic.successBorder,
      },
      warning: {
        DEFAULT: tokens.colors.semantic.warning,
        bg:      tokens.colors.semantic.warningBg,
        border:  tokens.colors.semantic.warningBorder,
      },
      error: {
        DEFAULT: tokens.colors.semantic.error,
        bg:      tokens.colors.semantic.errorBg,
        border:  tokens.colors.semantic.errorBorder,
      },
      info: {
        DEFAULT: tokens.colors.semantic.info,
        bg:      tokens.colors.semantic.infoBg,
        border:  tokens.colors.semantic.infoBorder,
      },

      // Surfaces — CSS var driven (light/dark mode)
      surface: {
        0:       'var(--surface-0)',
        1:       'var(--surface-1)',
        2:       'var(--surface-2)',
        3:       'var(--surface-3)',
        4:       'var(--surface-4)',
        overlay: 'var(--surface-overlay)',
      },

      // Text — CSS var driven
      text: {
        primary:   'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary:  'var(--text-tertiary)',
        inverse:   'var(--text-inverse)',
        disabled:  'var(--text-disabled)',
        link:      'var(--text-link)',
      },

      // Interactive — CSS var driven
      interactive: {
        primary:       'var(--interactive-primary)',
        primaryHover:  'var(--interactive-primary-hover)',
        primaryActive: 'var(--interactive-primary-active)',
        primaryText:   'var(--interactive-primary-text)',
        secondary:     'var(--interactive-secondary)',
        secondaryBorder:'var(--interactive-secondary-border)',
        secondaryText: 'var(--interactive-secondary-text)',
        danger:        'var(--interactive-danger)',
        dangerHover:   'var(--interactive-danger-hover)',
        dangerText:    'var(--interactive-danger-text)',
      },
    },

    // ─── Typography ────────────────────────────────────────────
    fontFamily: {
      display: [
        'DM Serif Display',
        'Georgia',
        'serif',
      ],
      body: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'sans-serif',
      ],
      mono: [
        'JetBrains Mono',
        'Fira Code',
        'Cascadia Code',
        'monospace',
      ],
      sans: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'sans-serif',
      ],
    },

    fontSize: {
      xs:   ['12px', { lineHeight: '1.4' }],
      sm:   ['14px', { lineHeight: '1.4' }],
      base: ['16px', { lineHeight: '1.6' }],
      lg:   ['20px', { lineHeight: '1.4' }],
      xl:   ['24px', { lineHeight: '1.2' }],
      '2xl':['32px', { lineHeight: '1.2' }],
      '3xl':['48px', { lineHeight: '1.1' }],
      '4xl':['64px', { lineHeight: '1.0' }],
      '5xl':['80px', { lineHeight: '1.0' }],
    },

    lineHeight: {
      tight:  '1.2',
      snug:   '1.4',
      normal: '1.6',
      loose:  '1.8',
    },

    fontWeight: {
      regular:  '400',
      medium:   '500',
      semibold: '600',
      bold:     '700',
    },

    letterSpacing: {
      tight:   '-0.025em',
      normal:  '0em',
      wide:    '0.025em',
      wider:   '0.05em',
      widest:  '0.1em',
    },

    // ─── Spacing ───────────────────────────────────────────────
    spacing: {
      0:  '0',
      1:  '4px',
      2:  '8px',
      3:  '12px',
      4:  '16px',
      5:  '20px',   // allowed convenience
      6:  '24px',
      7:  '28px',   // allowed convenience
      8:  '32px',
      10: '40px',   // touch target building block
      11: '44px',   // Apple HIG minimum touch target
      12: '48px',
      16: '64px',
      24: '96px',
      // Layout spacers
      px: '1px',
      '0.5': '2px',
    },

    // ─── Border Radius ─────────────────────────────────────────
    borderRadius: {
      none: '0',
      sm:   '4px',
      DEFAULT: '8px',
      md:   '8px',
      lg:   '16px',
      xl:   '24px',
      full: '9999px',
    },

    // ─── Shadows / Elevation ───────────────────────────────────
    boxShadow: {
      none:  'none',
      1:     tokens.shadow[1],
      2:     tokens.shadow[2],
      3:     tokens.shadow[3],
      4:     tokens.shadow[4],
      modal: tokens.shadow.modal,
      focus: '0 0 0 3px rgba(200, 180, 154, 0.50)',
      focusDanger: '0 0 0 3px rgba(239, 68, 68, 0.30)',
      // Dark mode overrides happen via CSS vars
      sm:    tokens.shadow[1],
      DEFAULT: tokens.shadow[2],
      md:    tokens.shadow[2],
      lg:    tokens.shadow[3],
      xl:    tokens.shadow[4],
      '2xl': tokens.shadow.modal,
    },

    // ─── Z-index ───────────────────────────────────────────────
    zIndex: {
      auto:     'auto',
      below:    '-1',
      0:        '0',
      raised:   '10',
      dropdown: '100',
      sticky:   '200',
      overlay:  '300',
      modal:    '400',
      toast:    '500',
      tooltip:  '600',
    },

    // ─── Animations / Transitions ──────────────────────────────
    transitionDuration: {
      fast:   '150ms',
      normal: '250ms',
      slow:   '400ms',
      enter:  '350ms',
      exit:   '200ms',
      DEFAULT: '250ms',
      75:  '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      250: '250ms',
      300: '300ms',
      400: '400ms',
      500: '500ms',
    },

    transitionTimingFunction: {
      DEFAULT:    'cubic-bezier(0.4, 0, 0.2, 1)',
      standard:   'cubic-bezier(0.4, 0, 0.2, 1)',
      decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
      accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
      spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
      linear:     'linear',
    },

    backdropBlur: {
      sm: '4px',
      DEFAULT: '12px',
      md: '12px',
      lg: '24px',
      xl: '40px',
    },

    extend: {
      // Height helpers for 44px touch targets
      minHeight: {
        touch: '44px',
        screen: '100dvh',
      },
      minWidth: {
        touch: '44px',
      },

      // Animation keyframes
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromBottom: {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideOutToBottom: {
          '0%':   { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.4' },
        },
        progressFill: {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--progress-width, 100%)' },
        },
        springIn: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        celebrate: {
          '0%':   { transform: 'scale(1)' },
          '15%':  { transform: 'scale(1.08)' },
          '30%':  { transform: 'scale(0.97)' },
          '45%':  { transform: 'scale(1.04)' },
          '60%':  { transform: 'scale(0.99)' },
          '100%': { transform: 'scale(1)' },
        },
      },

      animation: {
        'fade-in':          'fadeIn 350ms cubic-bezier(0, 0, 0.2, 1) both',
        'fade-out':         'fadeOut 200ms cubic-bezier(0.4, 0, 1, 1) both',
        'slide-up':         'slideUp 350ms cubic-bezier(0, 0, 0.2, 1) both',
        'slide-down':       'slideDown 350ms cubic-bezier(0, 0, 0.2, 1) both',
        'slide-in-bottom':  'slideInFromBottom 350ms cubic-bezier(0, 0, 0.2, 1) both',
        'slide-out-bottom': 'slideOutToBottom 200ms cubic-bezier(0.4, 0, 1, 1) both',
        'scale-in':         'scaleIn 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'shimmer':          'shimmer 1.8s ease-in-out infinite',
        'pulse':            'pulse 1.8s ease-in-out infinite',
        'spring-in':        'springIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'celebrate':        'celebrate 600ms cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },

  plugins: [],
};

export default config;
