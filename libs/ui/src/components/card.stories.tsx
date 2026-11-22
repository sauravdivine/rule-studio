import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';
import { Button } from './button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

const meta = {
  title: 'Components/Card',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ruleset: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Loan eligibility</CardTitle>
        <CardDescription>Version 3 · published 2 days ago</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Badge variant="approve">12 approve rules</Badge>
        <Badge variant="reject">4 reject</Badge>
      </CardContent>
      <CardFooter>
        <Button size="sm">Open</Button>
        <Button size="sm" variant="ghost">
          Simulate
        </Button>
      </CardFooter>
    </Card>
  ),
};
