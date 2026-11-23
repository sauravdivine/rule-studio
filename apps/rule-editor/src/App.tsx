import { Route, Routes } from 'react-router';
import type { HostProps } from '@rule-studio/host';
import { Toaster } from '@rule-studio/ui';
import { RulesetListPage } from './pages/ruleset-list-page';
import { RulesetPage } from './pages/ruleset-page';
import './styles.css';

// The rule editor's own routes, relative to wherever the shell mounts it
// (`/rulesets/*`). They run inside the shell's router, shared as a singleton
// (spec 005, decision 1).
//
// The Toaster is mounted here, not in the shell: each remote bundles its own
// copy of the UI library, and toast() only reaches a Toaster from the same copy.
export function App({ host }: HostProps) {
  return (
    <>
      <Routes>
        <Route index element={<RulesetListPage host={host} />} />
        <Route path=":id" element={<RulesetPage host={host} />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
