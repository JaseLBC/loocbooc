/**
 * Loocbooc Design Tokens — TypeScript/JS object
 * Mirrors tokens.css exactly. Used for Tailwind config and runtime access.
 * Import: import { tokens } from '@loocbooc/design-system/tokens'
 */

export const tokens = {
  colors: {
    brand: {
      black:       '#0A0A0A',
      white:       '#FAFAFA',
      accent:      '#C8B49A',
      accentLight: '#DDD0BC',
      accentDark:  '#A8946C',
    },
    semantic: {
      success:        '#22C55E',
      successBg:      '#F0FDF4',
      successBorder:  '#BBF7D0',
      warning:        '#F59E0B',
      warningBg:      '#FFFBEB',
      warningBorder:  '#FDE68A',
      error:          '#EF4444',
      errorBg:        '#FEF2F2',
      errorBorder:    '#FECACA',
      info:           '#3B82F6',
      infoBg:         '#EFF6FF',
      infoBorder:     '#BFDBFE',
    },
    surface: {
      0:       '#FFFFFF',
      1:       '#FFFFFF',
      2:       '#F5F5F5',
      3:       '#EBEBEB',
      4:       '#D4D4D4',
      overlay: 'rgba(0, 0, 0, 0.40)',
    },
    text: {
      primary:   '#0A0A0A',
      secondary: '#6B7280',
      tertiary:  '#9CA3AF',
      inverse:   '#FAFAFA',
      onAccent:  '#FAFAFA',
      disabled:  '#D1D5DB',
      link:      '#0A0A0A',
      linkHover: '#C8B49A',
    },
    interactive: {
      primary:       '#0A0A0A',
      primaryHover:  '#1F1F1F',
      primaryActive: '#3A3A3A',
      primaryText:   '#FAFAFA',
      secondary:        '#FAFAFA',
      secondaryHover:   '#F5F5F5',
      secondaryActive:  '#EBEBEB',
      secondaryBorder:  '#0A0A0A',
      secondaryText:    '#0A0A0A',
      ghostHover:    'rgba(10, 10, 10, 0.06)',
      ghostActive:   'rgba(10, 10, 10, 0.10)',
      danger:        '#EF4444',
      dangerHover:   '#DC2626',
      dangerActive:  '#B91C1C',
      dangerText:    '#FFFFFF',
      accent:        '#C8B49A',
      accentHover:   '#A8946C',
      accentText:    '#FAFAFA',
    },
  },

  fonts: {
    display: "'DM Serif Display', Georgia, serif",
    body:    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono:    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },

  fontSize: {
    xs:   '12px',
    sm:   '14px',
    base: '16px',
    lg:   '20px',
    xl:   '24px',
    '2xl': '32px',
    '3xl': '48px',
    '4xl': '64px',
    '5xl': '80px',
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
    normal:  '0',
    wide:    '0.025em',
    wider:   '0.05em',
    widest:  '0.1em',
  },

  spacing: {
    0:  '0',
    1:  '4px',
    2:  '8px',
    3:  '12px',
    4:  '16px',
    6:  '24px',
    8:  '32px',
    12: '48px',
    16: '64px',
    24: '96px',
  },

  borderRadius: {
    none: '0',
    sm:   '4px',
    md:   '8px',
    lg:   '16px',
    xl:   '24px',
    full: '9999px',
  },

  shadow: {
    0:     'none',
    1:     '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    2:     '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
    3:     '0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)',
    4:     '0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)',
    modal: '0 32px 64px rgba(0,0,0,0.20), 0 16px 32px rgba(0,0,0,0.10)',
  },

  motion: {
    duration: {
      fast:   '150ms',
      normal: '250ms',
      slow:   '400ms',
      enter:  '350ms',
      exit:   '200ms',
    },
    easing: {
      standard:   'cubic-bezier(0.4, 0, 0.2, 1)',
      decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
      accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
      spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },

  zIndex: {
    below:    -1,
    base:     0,
    raised:   10,
    dropdown: 100,
    sticky:   200,
    overlay:  300,
    modal:    400,
    toast:    500,
    tooltip:  600,
  },

  layout: {
    container: {
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },
  },

  touchTarget: {
    min: '44px',
  },

  blur: {
    sm: '4px',
    md: '12px',
    lg: '24px',
    xl: '40px',
  },
} as const;

export type Tokens = typeof tokens;

// Flat exports for convenience
export const colors     = tokens.colors;
export const fonts      = tokens.fonts;
export const fontSize   = tokens.fontSize;
export const spacing    = tokens.spacing;
export const shadow     = tokens.shadow;
export const motion     = tokens.motion;
export const zIndex     = tokens.zIndex;
export const borderRadius = tokens.borderRadius;
