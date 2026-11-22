import type { ComponentProps } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '../lib/utils';

// Radix's Label stops a double-click on the label from selecting its text.
export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm font-medium leading-none peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
