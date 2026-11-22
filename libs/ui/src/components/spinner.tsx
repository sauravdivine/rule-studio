import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export type SpinnerProps = ComponentProps<'span'> & {
  // Read out by screen readers; the icon itself is hidden from them.
  label?: string;
};

export function Spinner({
  className,
  label = 'Loading',
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center text-muted-foreground',
        className,
      )}
      {...props}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
