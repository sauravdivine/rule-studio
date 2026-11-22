import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '../lib/utils';

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  // Usually a Button, e.g. "Create ruleset". Leave out when the user can't act.
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      )}
      <div className="grid gap-1">
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
