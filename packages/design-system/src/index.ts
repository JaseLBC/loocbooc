/**
 * @loocbooc/design-system
 * Main barrel export.
 */

// Tokens
export { tokens, colors, fonts, fontSize, spacing, shadow, motion, zIndex, borderRadius } from './tokens';
export type { Tokens } from './tokens';

// Theme
export { ThemeProvider, useTheme, ThemeScript } from './theme';

// Components
export * from './components';

// Animations
export { useFadeIn, useSpring, PageTransition, NumberTicker } from './animations';

// Utils
export { cn } from './utils/cn';
