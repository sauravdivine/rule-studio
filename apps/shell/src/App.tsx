import { Component, Suspense, type ComponentType } from 'react';
import { AppShell, ErrorState, Spinner, ThemeToggle } from '@rule-studio/ui';
import { lazyProvider, resetProvider } from './mf';

// RemoteSlot loads one remote and contains its failures. If remoteEntry.js
// can't be fetched (remote not running, network error) or the remote throws
// while rendering, only this slot shows an error; the rest of the app works.
// React has no hook-based error boundary, so this is a class.
//
// "Try again" has to clear two caches: the federation runtime's (resetProvider)
// and React's, because React.lazy remembers a failed import forever, so the
// slot needs a brand-new lazy() component.
class RemoteSlot extends Component<
  { alias: string; name: string },
  { error: Error | null; Remote: ComponentType }
> {
  state = { error: null, Remote: lazyProvider(this.props.alias, 'App') };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  private retry = () => {
    resetProvider(this.props.alias);
    this.setState({
      error: null,
      Remote: lazyProvider(this.props.alias, 'App'),
    });
  };
  render() {
    const { error, Remote } = this.state;
    if (error) {
      return (
        <ErrorState
          title={`${this.props.name} is unavailable`}
          description="This part of Rule Studio could not load. The rest of the app still works."
          onRetry={this.retry}
        />
      );
    }
    return (
      <Suspense fallback={<Spinner label={`Loading ${this.props.name}`} />}>
        <Remote />
      </Suspense>
    );
  }
}

// Until routing arrives (spec 002, task 8), the shell shows all three remotes
// on one page, and the nav links jump to each section.
export function App() {
  return (
    <AppShell
      brand="Rule Studio"
      nav={
        <>
          <a
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            href="#rule-editor"
          >
            Rulesets
          </a>
          <a
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            href="#simulator"
          >
            Simulator
          </a>
          <a
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            href="#dashboard"
          >
            Dashboard
          </a>
        </>
      }
      actions={<ThemeToggle />}
    >
      <h1 className="sr-only">Rule Studio</h1>
      <div className="grid gap-6">
        <RemoteSlot alias="rule-editor" name="Rule editor" />
        <RemoteSlot alias="simulator" name="Simulator" />
        <RemoteSlot alias="dashboard" name="Dashboard" />
      </div>
    </AppShell>
  );
}

export default App;
