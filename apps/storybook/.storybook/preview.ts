import type { Preview } from '@storybook/react';
import '../../../packages/design-system/src/tokens/tokens.css';

// Mobile viewport presets matching Apple devices
const VIEWPORTS = {
  iPhoneSE: {
    name: 'iPhone SE (375px)',
    styles: { width: '375px', height: '667px' },
    type: 'mobile',
  },
  iPhone14: {
    name: 'iPhone 14 (390px)',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  iPadMini: {
    name: 'iPad mini (768px)',
    styles: { width: '768px', height: '1024px' },
    type: 'tablet',
  },
  desktop: {
    name: 'Desktop (1440px)',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  desktopSm: {
    name: 'Desktop small (1280px)',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color scheme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark',  title: 'Dark',  icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      document.documentElement.className = theme === 'dark' ? 'dark' : '';
      document.documentElement.setAttribute('data-theme', theme);

      return Story();
    },
  ],

  parameters: {
    viewport: {
      viewports: VIEWPORTS,
      defaultViewport: 'desktop',
    },

    backgrounds: {
      // Override with token values — controlled by .dark class on html
      default: 'surface',
      values: [
        { name: 'surface', value: 'var(--surface-0, #FFFFFF)' },
        { name: 'overlay', value: '#F5F5F5' },
      ],
    },

    actions: { argTypesRegex: '^on[A-Z].*' },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date:  /Date$/i,
      },
    },

    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
        ],
      },
    },
  },
};

export default preview;
