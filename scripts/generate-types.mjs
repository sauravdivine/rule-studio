// Generates code in libs/shared-types from contracts/openapi.yaml with @hey-api/openapi-ts:
// TypeScript types (types.gen.ts) and Zod schemas (zod.gen.ts).
// The ruleset data model comes in through the contract's $ref to ruleset.schema.json,
// so one generator produces every type and there is nothing to drift (spec 003).
// Run with: npm run contracts:types. Never edit the generated files by hand.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@hey-api/openapi-ts';
import * as prettier from 'prettier';

const root = new URL('..', import.meta.url).pathname;
const outDir = join(root, 'libs/shared-types/src/generated');
mkdirSync(outDir, { recursive: true });
// Left over from the old JSON Schema generator; the ruleset types now come from the contract.
rmSync(join(outDir, 'ruleset.ts'), { force: true });

// The HTTP API contract: types.gen.ts (types) and zod.gen.ts (runtime validators).
const apiOut = join(outDir, 'api');
rmSync(apiOut, { recursive: true, force: true });
await createClient({
  input: join(root, 'contracts/openapi.yaml'),
  output: { path: apiOut },
  plugins: ['@hey-api/typescript', 'zod'],
  logs: { level: 'silent' },
});
// We re-export from libs/shared-types/src/index.ts ourselves, so drop the generated barrel.
rmSync(join(apiOut, 'index.ts'), { force: true });

// Format the generated API files with the repo's Prettier settings.
for (const file of ['types.gen.ts', 'zod.gen.ts']) {
  const path = join(apiOut, file);
  const options = (await prettier.resolveConfig(path)) ?? {};
  const formatted = await prettier.format(readFileSync(path, 'utf8'), {
    ...options,
    filepath: path,
  });
  writeFileSync(path, formatted);
  console.log(`wrote libs/shared-types/src/generated/api/${file}`);
}
