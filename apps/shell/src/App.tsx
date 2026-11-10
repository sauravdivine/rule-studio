import { Component, Suspense, type ReactNode } from 'react';
import { lazyProvider } from './mf';

// ProviderBoundary catches the lazy() rejection that fires when a provider's
// remoteEntry.js can't be fetched (provider not running, network error,
// etc.). Without it any one missing provider unmounts the whole consumer
// tree. React has no built-in functional error boundary so this is a class.
// Wrap each <ProviderBoundary> in your router of choice if you need routing.
class ProviderBoundary extends Component<
  { children: ReactNode; name: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert">
          <p>
            Provider &quot;{this.props.name}&quot; unavailable:{' '}
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return (
      <Suspense fallback={<p>Loading {this.props.name}...</p>}>
        {this.props.children}
      </Suspense>
    );
  }
}

const ProviderRuleEditor = lazyProvider('rule-editor', 'App');
const ProviderSimulator = lazyProvider('simulator', 'App');
const ProviderDashboard = lazyProvider('dashboard', 'App');

export function App() {
  return (
    <main>
      <h1>shell</h1>
      <ProviderBoundary name="rule-editor">
        <ProviderRuleEditor />
      </ProviderBoundary>
      <ProviderBoundary name="simulator">
        <ProviderSimulator />
      </ProviderBoundary>
      <ProviderBoundary name="dashboard">
        <ProviderDashboard />
      </ProviderBoundary>
    </main>
  );
}

export default App;
