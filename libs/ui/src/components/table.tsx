import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

// A plain HTML table, styled. Real <table> markup, so screen readers announce
// row and column headers as you move through cells. A wide table scrolls
// sideways inside its wrapper; min-w-0 stops it from stretching a grid or
// flex parent instead (found in spec 005, where it pushed the editor under
// the problems panel).
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('bg-muted/50 [&_tr]:border-b', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('border-b transition-colors hover:bg-muted/40', className)}
      {...props}
    />
  );
}

export function TableHead({
  className,
  scope = 'col',
  ...props
}: ComponentProps<'th'>) {
  return (
    <th
      scope={scope}
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />
  );
}

export function TableCaption({
  className,
  ...props
}: ComponentProps<'caption'>) {
  return (
    <caption
      className={cn('mt-3 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
