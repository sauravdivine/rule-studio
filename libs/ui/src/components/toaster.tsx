import { Toaster as Sonner, toast } from 'sonner';
import { useTheme } from '../lib/theme';

// Short confirmations ("Saved", "Published"). Sonner announces each toast to
// screen readers through a live region, so they aren't only visual.
//
// Mount one <Toaster /> in each app that calls toast(), not only in the shell:
// sonner keeps its queue in module state, and every remote bundles its own copy
// of this library, so a toast() in a remote only reaches a Toaster from the
// same copy. (The same identity rule as React context; see spec 004.)
export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-card text-card-foreground border shadow-md',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}

export { toast };
