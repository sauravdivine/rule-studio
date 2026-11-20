// Generates code in libs/shared-types from contracts/:
//   1. TypeScript types from the JSON Schemas (json-schema-to-typescript)
//   2. TypeScript types and Zod schemas from openapi.yaml (@hey-api/openapi-ts)
// Run with: npm run contracts:types. Never edit the generated files by hand.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'json-schema-to-typescript';
import { createClient } from '@hey-api/openapi-ts';
import * as prettier from 'prettier';

const root = new URL('..', import.meta.url).pathname;
const outDir = join(root, 'libs/shared-types/src/generated');
mkdirSync(outDir, { recursive: true });

const contracts = [
  { schema: 'contracts/ruleset.schema.json', out: 'ruleset.ts' },
];

const banner = `/**
 * GENERATED FILE. DO NOT EDIT.
 * Source: {{source}}
 * Regenerate with: npm run contracts:types
 */`;

for (const { schema, out } of contracts) {
  const json = JSON.parse(readFileSync(join(root, schema), 'utf8'));
  const ts = await compile(json, json.title, {
    bannerComment: banner.replace('{{source}}', schema),
    additionalProperties: false,
    unreachableDefinitions: true,
    maxItems: -1,
    style: { singleQuote: true },
  });
  const path = join(outDir, out);
  const options = (await prettier.resolveConfig(path)) ?? {};
  writeFileSync(path, await prettier.format(ts, { ...options, filepath: path }));
  console.log(`wrote libs/shared-types/src/generated/${out}`);
}

// 2. The HTTP API contract: types.gen.ts (types) and zod.gen.ts (runtime validators).
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
