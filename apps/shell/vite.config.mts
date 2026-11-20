import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

const PORT = 4200;

export default defineConfig({
  server: {
    port: PORT,
    strictPort: true,
    host: '127.0.0.1',
    // Same origin for the API (spec 002): the browser talks only to :4200, and Vite
    // forwards these paths to the API on :3000. This keeps the refresh cookie
    // first-party and means the API needs no CORS.
    proxy: {
      '/api': 'http://localhost:3000',
      '/.well-known': 'http://localhost:3000',
    },
  },
  preview: { port: PORT, strictPort: true },
  build: { target: 'chrome89' },
  plugins: [
    federation({
      name: 'shell',
      // No build-time `remotes:` block - the consumer registers them at
      // runtime in src/mf.ts at module load time.
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
    react(),
    nxReadySignal(),
  ],
});
