import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = { title: 'Foundations/Colour tokens' } satisfies Meta;
export default meta;

const pairs = [
  ['background', 'foreground'],
  ['card', 'card-foreground'],
  ['muted', 'muted-foreground'],
  ['secondary', 'secondary-foreground'],
  ['accent', 'accent-foreground'],
  ['primary', 'primary-foreground'],
  ['destructive', 'destructive-foreground'],
  ['success', 'success-foreground'],
  ['warning', 'warning-foreground'],
  ['approve', 'approve-foreground'],
  ['reject', 'reject-foreground'],
  ['refer', 'refer-foreground'],
] as const;

// Each swatch is a surface token with its text token on top. Switch the
// toolbar theme to see the dark values.
export const Palette: StoryObj = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {pairs.map(([bg, fg]) => (
        <div
          key={bg}
          className="rounded-lg border p-4"
          style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
        >
          <div className="font-semibold">--{bg}</div>
          <div className="text-xs">text: --{fg}</div>
        </div>
      ))}
    </div>
  ),
};
