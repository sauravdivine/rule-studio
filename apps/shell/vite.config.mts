import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import { mfShared } from '../../tools/mf-shared.mts';

const PORT = 4200;

// Same origin for the API (spec 002): the browser talks only to :4200, and Vite
// forwards these paths to the API on :3000. This keeps the refresh cookie
// first-party and means the API needs no CORS. Used by dev and preview.
const apiProxy = {
  '/api': 'http://localhost:3000',
  '/.well-known': 'http://localhost:3000',
};

export default defineConfig(({ mode }) => ({
  // The demo sign-in buttons need the seeded demo password. Read it from the
  // repo's .env (the same value the seed uses) so there is one place to change it.
  // It is public by design: the demo accounts exist for anyone to try.
  define: {
    __DEMO_PASSWORD__: JSON.stringify(
      loadEnv(mode, '../..', 'SEED_')['SEED_DEMO_PASSWORD'] ?? '',
    ),
  },
  server: {
    port: PORT,
    strictPort: true,
    host: '127.0.0.1',
    proxy: apiProxy,
  },
  preview: { port: PORT, strictPort: true, proxy: apiProxy },
  build: { target: 'chrome89' },
  plugins: [
    tailwindcss(),
    federation({
      name: 'shell',
      // No build-time `remotes:` block - the consumer registers them at
      // runtime in src/mf.ts at module load time.
      shared: mfShared,
    }),
    react(),
    nxReadySignal(),
  ],
}));
