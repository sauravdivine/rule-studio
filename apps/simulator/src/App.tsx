// Exposed by the federation plugin as 'simulator/App'.
// Consumers render it lazily via `lazyProvider('simulator', 'App')`.
export function App() {
  return (
    <section data-testid="simulator">
      <h1>Hello from simulator</h1>
    </section>
  );
}

export default App;
