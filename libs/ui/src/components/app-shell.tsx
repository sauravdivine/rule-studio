import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type AppShellProps = {
  // Product name or logo, top left.
  brand: ReactNode;
  // Main navigation links, rendered inside a labelled <nav>.
  nav?: ReactNode;
  // Right side of the header: theme toggle, user menu.
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

// Page frame: skip link, header with nav, then the main content area.
export function AppShell({
  brand,
  nav,
  actions,
  children,
  className,
}: AppShellProps) {
  return (
    <div className={cn('flex min-h-screen flex-col bg-background', className)}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <div className="font-semibold">{brand}</div>
          {nav && (
            <nav aria-label="Main" className="flex items-center gap-1 text-sm">
              {nav}
            </nav>
          )}
          {actions && (
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          )}
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none"
      >
        {children}
      </main>
    </div>
  );
}
