import type { ComponentProps } from 'react';
import { Switch as Primitive } from 'radix-ui';
import { cn } from '../lib/utils';

// For settings that take effect at once (a rule's "enabled"). role="switch", so
// a screen reader says "on" or "off".
export function Switch({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <Primitive.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </Primitive.Root>
  );
}
