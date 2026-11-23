import type { ComponentProps } from 'react';
import { Checkbox as Primitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        'peer size-4 shrink-0 rounded-sm border border-input shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <Primitive.Indicator className="flex items-center justify-center">
        <Check className="size-3.5" aria-hidden="true" />
      </Primitive.Indicator>
    </Primitive.Root>
  );
}
