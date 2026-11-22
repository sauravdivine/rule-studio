import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../lib/utils';
import { Label } from './label';

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export type FormFieldProps = {
  label: ReactNode;
  // One form control (Input, select, textarea). It receives id and aria wiring.
  children: ReactElement<ControlProps>;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

// Connects a label, hint and error message to a control, so a screen reader
// announces "Email, invalid entry, Enter a valid email address" on focus.
export function FormField({
  label,
  children,
  hint,
  error,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const id = (isValidElement(children) && children.props.id) || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [children.props['aria-describedby'], hintId, errorId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
