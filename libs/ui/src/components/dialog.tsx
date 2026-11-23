import type { ComponentProps, ReactNode } from 'react';
import { AlertDialog as AlertPrimitive, Dialog as Primitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { buttonVariants } from './button';

// Radix does the accessibility work: focus moves into the dialog and is trapped
// there, Escape closes it, focus returns to whatever opened it, the rest of the
// page is hidden from screen readers, and the title labels the dialog.

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

const overlayClasses = 'fixed inset-0 z-50 bg-black/50';
const contentClasses =
  'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-md focus:outline-none';

export type DialogContentProps = ComponentProps<typeof Primitive.Content> & {
  title: ReactNode;
  // Read out with the title when the dialog opens. Leave out only if the title says it all.
  description?: ReactNode;
};

export function DialogContent({
  className,
  title,
  description,
  children,
  ...props
}: DialogContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={overlayClasses} />
      <Primitive.Content
        className={cn(contentClasses, className)}
        // Radix warns without a description; an explicit undefined says "none on purpose".
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        <div className="grid gap-1.5 pr-6">
          <Primitive.Title className="text-lg font-semibold leading-none">
            {title}
          </Primitive.Title>
          {description && (
            <Primitive.Description className="text-sm text-muted-foreground">
              {description}
            </Primitive.Description>
          )}
        </div>
        {children}
        <Primitive.Close
          className="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

// A yes/no confirmation ("Delete this rule?"). Unlike Dialog it can't be closed
// by clicking outside, and focus starts on Cancel, so a stray Enter is harmless.
export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlayClasses} />
        <AlertPrimitive.Content className={contentClasses}>
          <div className="grid gap-1.5">
            <AlertPrimitive.Title className="text-lg font-semibold leading-none">
              {title}
            </AlertPrimitive.Title>
            <AlertPrimitive.Description className="text-sm text-muted-foreground">
              {description}
            </AlertPrimitive.Description>
          </div>
          <DialogFooter>
            <AlertPrimitive.Cancel
              className={buttonVariants({ variant: 'outline' })}
            >
              {cancelLabel}
            </AlertPrimitive.Cancel>
            <AlertPrimitive.Action
              className={buttonVariants({
                variant: destructive ? 'destructive' : 'primary',
              })}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertPrimitive.Action>
          </DialogFooter>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
