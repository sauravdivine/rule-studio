import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

// Placeholder shape while content loads. Hidden from screen readers: pair it
// with a Spinner or aria-busy on the region that is loading.
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
