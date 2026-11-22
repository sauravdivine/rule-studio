import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileQuestion } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Skeleton } from './skeleton';
import { Spinner } from './spinner';

const meta = {
  title: 'Components/Feedback',
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Alerts: Story = {
  render: () => (
    <div className="grid max-w-lg gap-3">
      <Alert>
        <AlertTitle>Draft saved</AlertTitle>
        <AlertDescription>
          Your changes are saved but not published.
        </AlertDescription>
      </Alert>
      <Alert variant="success">
        <AlertTitle>Published</AlertTitle>
        <AlertDescription>Version 4 is now live.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Unreachable rule</AlertTitle>
        <AlertDescription>
          Rule 3 can never match because rule 2 always does first.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Could not publish</AlertTitle>
        <AlertDescription>
          Fix the 2 errors in the ruleset and try again.
        </AlertDescription>
      </Alert>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="grid max-w-sm gap-3">
      <Spinner label="Loading rulesets" />
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={FileQuestion}
      title="No rulesets yet"
      description="Create your first ruleset to start writing rules."
      action={<Button>Create ruleset</Button>}
    />
  ),
};

export const Error: Story = {
  render: () => (
    <ErrorState
      description="The server did not answer. Check your connection."
      onRetry={() => undefined}
    />
  ),
};
