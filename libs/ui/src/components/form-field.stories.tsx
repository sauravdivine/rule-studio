import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormField } from './form-field';
import { Input } from './input';

const meta = {
  title: 'Components/FormField',
  component: FormField,
  args: {
    label: 'Email',
    children: <Input type="email" placeholder="you@company.com" />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: 'We never share it.' } };

export const WithError: Story = {
  args: {
    error: 'Enter a valid email address.',
    children: <Input type="email" defaultValue="not-an-email" />,
  },
};

export const Disabled: Story = {
  args: { children: <Input disabled defaultValue="viewer@rulestudio.dev" /> },
};
