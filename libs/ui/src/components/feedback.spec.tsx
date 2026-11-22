import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { axeViolations } from '../test/axe';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './card';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Skeleton } from './skeleton';
import { Spinner } from './spinner';

describe('Alert', () => {
  it('interrupts the screen reader only for errors', () => {
    render(
      <>
        <Alert variant="destructive">Failed</Alert>
        <Alert variant="success">Saved</Alert>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});

describe('Badge', () => {
  it.each(['approve', 'reject', 'refer'] as const)(
    'uses the %s outcome colour',
    (variant) => {
      render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toHaveClass(`bg-${variant}`);
    },
  );
});

describe('CardTitle', () => {
  it('is an h3 unless the page needs another level', () => {
    render(
      <>
        <CardTitle>Ruleset</CardTitle>
        <CardTitle as="h1">Sign in</CardTitle>
      </>,
    );
    expect(
      screen.getByRole('heading', { name: 'Ruleset', level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in', level: 1 }),
    ).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('announces a label', () => {
    render(<Spinner label="Loading rulesets" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading rulesets');
  });
});

describe('ErrorState', () => {
  it('shows a retry button only when it can retry', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ErrorState description="The server did not answer." />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <ErrorState description="The server did not answer." onRetry={onRetry} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('EmptyState', () => {
  it('shows the title, description and action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No rulesets yet"
        description="Create one to get started."
        action={<Button>Create ruleset</Button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No rulesets yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create ruleset' }),
    ).toBeInTheDocument();
  });
});

describe('feedback components together', () => {
  it('have no accessibility violations', async () => {
    const { container } = render(
      <main>
        <Card>
          <CardHeader>
            <CardTitle>Loan eligibility</CardTitle>
            <CardDescription>Version 3</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="approve">Approve</Badge>{' '}
            <Badge variant="reject">Reject</Badge>{' '}
            <Badge variant="refer">Refer</Badge>
            <Skeleton className="h-4 w-20" />
            <Spinner />
          </CardContent>
        </Card>
        <Alert variant="warning">
          <AlertTitle>Unpublished changes</AlertTitle>
          <AlertDescription>Publish to make them live.</AlertDescription>
        </Alert>
        <ErrorState onRetry={() => undefined} />
        <EmptyState icon={Inbox} title="Nothing here" />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
