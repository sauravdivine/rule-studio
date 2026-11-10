// Generates TypeScript types in libs/shared-types from the JSON Schemas in contracts/.
// Run with: npm run contracts:types. Never edit the generated files by hand.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'json-schema-to-typescript';

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
  writeFileSync(join(outDir, out), ts);
  console.log(`wrote libs/shared-types/src/generated/${out}`);
}
