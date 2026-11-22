import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Creates a fresh test database and applies the migrations (src/test/global-setup.ts).
    globalSetup: ['./src/test/global-setup.ts'],
    // The HTTP tests share one test database, so test files run one at a time.
    fileParallelism: false,
    // Argon2 is deliberately slow, so allow more time than the default 5 s.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
