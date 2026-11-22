import type { Preview } from '@storybook/react-vite';
import { applyTheme } from '../src/lib/theme';
import '../src/styles/global.css';

const preview: Preview = {
  // A "Theme" switch in the Storybook toolbar. It sets <html data-theme>,
  // exactly as the app does, so stories show the real light and dark styles.
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      applyTheme(context.globals['theme'] === 'dark' ? 'dark' : 'light');
      return (
        <div className="bg-background p-6 text-foreground">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
