import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The libraries the shell and every remote share at runtime (Module Federation),
// in one place so the rules can't drift between apps.
//
// singleton: one copy for the whole page. React needs that (two Reacts break
// hooks); React Router needs it because its context is matched by object
// identity, like any React context (spec 005).
//
// strictVersion on react-router: if a remote was built against a different
// version than the shell provides, it refuses to load and says why, instead of
// silently running a second router that can't see the shell's.
const rootPackage = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../package.json', import.meta.url)),
    'utf8',
  ),
) as { dependencies: Record<string, string> };

export const mfShared = {
  react: { singleton: true },
  'react-dom': { singleton: true },
  'react-router': {
    singleton: true,
    strictVersion: true,
    requiredVersion: rootPackage.dependencies['react-router'],
  },
};
