import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests only. Kept apart from vite.config.mts so the Module Federation and
// Tailwind plugins don't run in tests.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/rule-editor',
  plugins: [react()],
  test: {
    name: 'rule-editor',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    reporters: ['default'],
  },
});
