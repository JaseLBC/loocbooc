import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: {
          DEFAULT: '#141414',
          elevated: '#1E1E1E',
        },
        border: '#2A2A2A',
        accent: {
          DEFAULT: '#FFFFFF',
          indigo: '#6366F1',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        text: {
          primary: '#F5F5F5',
          secondary: '#A3A3A3',
          muted: '#525252',
        },
        // shadcn compatibility
        foreground: '#F5F5F5',
        card: {
          DEFAULT: '#141414',
          foreground: '#F5F5F5',
        },
        popover: {
          DEFAULT: '#1E1E1E',
          foreground: '#F5F5F5',
        },
        primary: {
          DEFAULT: '#FFFFFF',
          foreground: '#0A0A0A',
        },
        secondary: {
          DEFAULT: '#1E1E1E',
          foreground: '#F5F5F5',
        },
        muted: {
          DEFAULT: '#1E1E1E',
          foreground: '#A3A3A3',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#F5F5F5',
        },
        input: '#2A2A2A',
        ring: '#6366F1',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(99, 102, 241, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
