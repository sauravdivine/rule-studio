import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Draft' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'outline', 'approve', 'reject', 'refer'],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

// The three rule outcomes from spec 001.
export const Outcomes: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="approve">Approve</Badge>
      <Badge variant="reject">Reject</Badge>
      <Badge variant="refer">Refer</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  ),
};
