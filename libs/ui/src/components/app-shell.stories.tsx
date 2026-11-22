import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './app-shell';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { ThemeToggle } from './theme-toggle';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    brand: 'Rule Studio',
    nav: (
      <>
        <Button variant="ghost" size="sm">
          Rulesets
        </Button>
        <Button variant="ghost" size="sm">
          Simulator
        </Button>
        <Button variant="ghost" size="sm">
          Dashboard
        </Button>
      </>
    ),
    actions: <ThemeToggle />,
    children: (
      <EmptyState
        title="No rulesets yet"
        description="Pick something from the menu."
      />
    ),
  },
};
