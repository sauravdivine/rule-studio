import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/utils';

const alertVariants = cva(
  'relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        info: 'bg-card text-card-foreground [&>svg]:text-primary',
        success:
          'border-success/40 bg-card text-card-foreground [&>svg]:text-success',
        warning:
          'border-warning/40 bg-card text-card-foreground [&>svg]:text-warning',
        destructive:
          'border-destructive/40 bg-card text-destructive [&>svg]:text-destructive',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const icons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleAlert,
} as const;

export type AlertProps = ComponentProps<'div'> &
  VariantProps<typeof alertVariants>;

export function Alert({
  className,
  variant,
  children,
  role,
  ...props
}: AlertProps) {
  const Icon = icons[variant ?? 'info'];
  return (
    <div
      // Errors interrupt the screen reader (alert); everything else waits its turn (status).
      role={role ?? (variant === 'destructive' ? 'alert' : 'status')}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('font-medium leading-none', className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div className={cn('text-muted-foreground', className)} {...props} />;
}
