import type { ComponentProps } from 'react';
import { Select as Primitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<
  ComponentProps<typeof Primitive.Root>,
  'children'
> & {
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

// A styled single-choice dropdown. Works with FormField (it passes id and aria
// props to the trigger). Keyboard: Space or Enter opens it, arrows move, typing
// jumps to an option, Escape closes.
export function Select({
  options,
  placeholder = 'Choose…',
  id,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: SelectProps) {
  return (
    <Primitive.Root {...props}>
      <Primitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          'data-[placeholder]:text-muted-foreground aria-invalid:border-destructive',
          className,
        )}
      >
        <Primitive.Value placeholder={placeholder} />
        <Primitive.Icon>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-card text-card-foreground shadow-md"
        >
          <Primitive.Viewport className="p-1">
            {options.map((option) => (
              <Primitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
              >
                <Primitive.ItemText>{option.label}</Primitive.ItemText>
                <Primitive.ItemIndicator className="absolute right-2 inline-flex">
                  <Check className="size-4" aria-hidden="true" />
                </Primitive.ItemIndicator>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
