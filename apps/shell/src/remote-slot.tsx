import { Component, Suspense, type ComponentType } from 'react';
import type { Host, HostProps } from '@rule-studio/host';
import { ErrorState, Spinner } from '@rule-studio/ui';
import { lazyProvider, resetProvider } from './mf';

// RemoteSlot loads one remote and contains its failures. If remoteEntry.js
// can't be fetched (remote not running, network error) or the remote throws
// while rendering, only this slot shows an error; the rest of the app works.
// React has no hook-based error boundary, so this is a class.
//
// "Try again" has to clear two caches: the federation runtime's (resetProvider)
// and React's, because React.lazy remembers a failed import forever, so the
// slot needs a brand-new lazy() component.
export class RemoteSlot extends Component<
  { alias: string; name: string; host: Host },
  { error: Error | null; Remote: ComponentType<HostProps> }
> {
  state = {
    error: null,
    Remote: lazyProvider<HostProps>(this.props.alias, 'App'),
  };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  private retry = () => {
    resetProvider(this.props.alias);
    this.setState({
      error: null,
      Remote: lazyProvider<HostProps>(this.props.alias, 'App'),
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
        <Remote host={this.props.host} />
      </Suspense>
    );
  }
}
