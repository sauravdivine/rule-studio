import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
  );
}

// A heading element so cards show up in a screen reader's headings list.
// Defaults to h3; pass `as` to fit the page's outline (a login card is the
// page's h1). Headings must not skip levels or nest.
export function CardTitle({
  className,
  children,
  as: Heading = 'h3',
  ...props
}: ComponentProps<'h3'> & { as?: 'h1' | 'h2' | 'h3' | 'h4' }) {
  return (
    <Heading
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </Heading>
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 p-6 pt-0', className)}
      {...props}
    />
  );
}
