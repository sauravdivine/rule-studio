// Checks contracts/ruleset.schema.json against spec 001's acceptance criteria:
// every example must validate, and every known-bad case must be rejected.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = new URL('..', import.meta.url).pathname;
const schema = JSON.parse(
  readFileSync(join(root, 'contracts/ruleset.schema.json'), 'utf8'),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
const validate = ajv.compile(schema);

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failures++;
    if (detail) console.log(detail);
  }
};

// 1. Every example validates.
const examplesDir = join(root, 'contracts/examples');
const examples = readdirSync(examplesDir).filter((f) => f.endsWith('.json'));
for (const file of examples) {
  const data = JSON.parse(readFileSync(join(examplesDir, file), 'utf8'));
  const ok = validate(data);
  check(
    `example ${file} validates`,
    ok,
    JSON.stringify(validate.errors, null, 2),
  );
}

// 2. Known-bad cases are rejected.
const base = JSON.parse(
  readFileSync(join(examplesDir, 'loan-approval.json'), 'utf8'),
);
const withWhen = (when) => {
  const copy = structuredClone(base);
  copy.rules[0].when = when;
  return copy;
};
const mutate = (fn) => {
  const copy = structuredClone(base);
  fn(copy);
  return copy;
};
const cond = {
  type: 'condition',
  field: 'creditScore',
  operator: 'LT',
  value: 600,
};
const group = (children) => ({ type: 'group', operator: 'AND', children });

const badCases = [
  ['4 levels of nesting', withWhen(group([group([group([group([cond])])])]))],
  ['unknown operator', withWhen(group([{ ...cond, operator: 'ROUGHLY' }]))],
  [
    'BETWEEN with one value',
    withWhen(group([{ ...cond, operator: 'BETWEEN', value: [1] }])),
  ],
  [
    'IN with a non-array value',
    withWhen(group([{ ...cond, operator: 'IN', value: 600 }])),
  ],
  [
    'IS_EMPTY carrying a value',
    withWhen(group([{ ...cond, operator: 'IS_EMPTY' }])),
  ],
  ['empty group', withWhen(group([]))],
  ['unknown decision', mutate((c) => (c.rules[0].then.decision = 'MAYBE'))],
  ['extra property on a rule', mutate((c) => (c.rules[0].colour = 'red'))],
  ['invalid input field key', mutate((c) => (c.inputFields[0].key = '1score'))],
  ['schemaVersion other than 1', mutate((c) => (c.schemaVersion = 2))],
  ['missing schemaVersion', mutate((c) => delete c.schemaVersion)],
  ['unknown hit strategy', mutate((c) => (c.hitStrategy = 'ANY'))],
  [
    'defaultAction as a bare decision',
    mutate((c) => (c.defaultAction = 'REFER')),
  ],
  [
    'status on the working document (moved to spec 003)',
    mutate((c) => (c.status = 'ACTIVE')),
  ],
  [
    'version on the working document (moved to spec 003)',
    mutate((c) => (c.version = 3)),
  ],
];
for (const [label, data] of badCases) {
  check(`rejects ${label}`, !validate(data));
}

console.log(
  failures ? `\n${failures} check(s) failed` : '\nAll contract checks passed',
);
process.exit(failures ? 1 : 0);
