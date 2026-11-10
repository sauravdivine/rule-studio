// Exposed by the federation plugin as 'rule-editor/App'.
// Consumers render it lazily via `lazyProvider('rule-editor', 'App')`.
export function App() {
  return (
    <section data-testid="rule-editor">
      <h1>Hello from rule-editor</h1>
    </section>
  );
}

export default App;
