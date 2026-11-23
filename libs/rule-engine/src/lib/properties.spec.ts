import fc from 'fast-check';
import type {
  Condition,
  Decision,
  InputField,
  Rule,
  RulesetContent,
} from '@rule-studio/shared-types';
import { operatorsFor } from '@rule-studio/ruleset-validation';
import { evaluate, STRICTNESS, type Input } from './engine.js';

// Property-based tests (spec 006, decision 7). Instead of a few hand-picked
// examples, fast-check generates thousands of random rulesets and inputs and
// checks rules that must ALWAYS hold. When one fails, it shrinks the case to
// the smallest ruleset and input that still fail, and prints it.

const FIELDS: InputField[] = [
  { key: 'n', label: 'N', type: 'NUMBER' },
  { key: 't', label: 'T', type: 'STRING', allowedValues: ['A', 'B', 'C'] },
  { key: 'b', label: 'B', type: 'BOOLEAN' },
  { key: 'd', label: 'D', type: 'DATE' },
];

// A value of the field's type, from a small set so conditions fire often.
const valueFor = (
  field: InputField,
): fc.Arbitrary<string | number | boolean> => {
  switch (field.type) {
    case 'NUMBER':
      return fc.integer({ min: 0, max: 10 });
    case 'STRING':
      return fc.constantFrom('A', 'B', 'C');
    case 'BOOLEAN':
      return fc.boolean();
    case 'DATE':
      return fc.constantFrom('2026-01-01', '2026-06-15', '2026-12-31');
  }
};

const condition: fc.Arbitrary<Condition> = fc
  .constantFrom(...FIELDS)
  .chain((field) =>
    fc.constantFrom(...operatorsFor(field.type)).chain((operator) => {
      const base = { type: 'condition' as const, field: field.key, operator };
      if (operator === 'IS_EMPTY' || operator === 'IS_NOT_EMPTY')
        return fc.constant(base as Condition);
      if (operator === 'BETWEEN')
        return fc
          .tuple(valueFor(field), valueFor(field))
          .map(
            ([x, y]) =>
              ({ ...base, value: x <= y ? [x, y] : [y, x] }) as Condition,
          );
      if (operator === 'IN' || operator === 'NOT_IN')
        return fc
          .array(valueFor(field), { minLength: 1, maxLength: 3 })
          .map((value) => ({ ...base, value }) as Condition);
      if (operator === 'CONTAINS' || operator === 'STARTS_WITH')
        return fc
          .constantFrom('A', 'B')
          .map((value) => ({ ...base, value }) as Condition);
      return valueFor(field).map((value) => ({ ...base, value }) as Condition);
    }),
  );

// Groups up to 3 levels, like the contract allows.
const group = (depth: number): fc.Arbitrary<Rule['when']> =>
  fc.record({
    type: fc.constant('group' as const),
    operator: fc.constantFrom('AND' as const, 'OR' as const),
    children: fc.array(
      depth < 3
        ? fc.oneof(
            { weight: 3, arbitrary: condition },
            { weight: 1, arbitrary: group(depth + 1) },
          )
        : condition,
      {
        minLength: 1,
        maxLength: 3,
      },
    ),
  }) as fc.Arbitrary<Rule['when']>;

const decision = fc.constantFrom<Decision>('APPROVE', 'REFER', 'REJECT');

const ruleset: fc.Arbitrary<RulesetContent> = fc
  .uniqueArray(fc.integer({ min: 1, max: 100 }), { maxLength: 8 })
  .chain((priorities) =>
    fc.tuple(
      fc.tuple(
        ...priorities.map((priority, i) =>
          fc.record({
            id: fc.constant(`rule-${i}`),
            name: fc.constant(`Rule ${i}`),
            priority: fc.constant(priority),
            enabled: fc.boolean(),
            when: group(1),
            then: fc.record({ decision, reason: fc.constant(`reason ${i}`) }),
          }),
        ),
      ),
      fc.constantFrom<RulesetContent['hitStrategy']>('FIRST', 'PRIORITY'),
      decision,
    ),
  )
  .map(([rules, hitStrategy, defaultDecision]) => ({
    schemaVersion: 1,
    inputFields: FIELDS,
    hitStrategy,
    defaultAction: { decision: defaultDecision, reason: 'default' },
    rules: rules as Rule[],
  }));

// Each field present, null, or absent.
const input: fc.Arbitrary<Input> = fc
  .tuple(
    ...FIELDS.map((f) =>
      fc.option(fc.option(valueFor(f), { nil: null }), { nil: undefined }),
    ),
  )
  .map((values) =>
    Object.fromEntries(
      FIELDS.map((f, i) => [f.key, values[i]]).filter(
        ([, v]) => v !== undefined,
      ),
    ),
  );

const RUNS = { numRuns: 1000 };
const byId = (content: RulesetContent) =>
  new Map(content.rules.map((r) => [r.id, r]));

describe('engine properties (fast-check)', () => {
  it('gives the same answer every time', () => {
    fc.assert(
      fc.property(ruleset, input, (content, record) => {
        expect(evaluate(content, record, { explain: true })).toEqual(
          evaluate(content, record, { explain: true }),
        );
      }),
      RUNS,
    );
  });

  it('only lists enabled rules as fired, in priority order', () => {
    fc.assert(
      fc.property(ruleset, input, (content, record) => {
        const rules = byId(content);
        const fired = evaluate(content, record).firedRules.map(
          (id) => rules.get(id) as Rule,
        );
        expect(fired.every((r: Rule) => r.enabled)).toBe(true);
        expect(fired.map((r) => r.priority)).toEqual(
          [...fired.map((r) => r.priority)].sort((a, b) => a - b),
        );
      }),
      RUNS,
    );
  });

  it('FIRST: at most one rule fires, and it decides; otherwise the default', () => {
    fc.assert(
      fc.property(ruleset, input, (base, record) => {
        const content = { ...base, hitStrategy: 'FIRST' as const };
        const { output, firedRules } = evaluate(content, record);
        expect(firedRules.length).toBeLessThanOrEqual(1);
        expect(output).toEqual(
          firedRules.length
            ? byId(content).get(firedRules[0])?.then
            : content.defaultAction,
        );
      }),
      RUNS,
    );
  });

  it('PRIORITY: the decision is the strictest of the fired rules', () => {
    fc.assert(
      fc.property(ruleset, input, (base, record) => {
        const content = { ...base, hitStrategy: 'PRIORITY' as const };
        const rules = byId(content);
        const { output, firedRules } = evaluate(content, record);
        if (firedRules.length === 0) {
          expect(output).toEqual(content.defaultAction);
        } else {
          const strictness = firedRules.map(
            (id: string) => STRICTNESS[(rules.get(id) as Rule).then.decision],
          );
          expect(STRICTNESS[output.decision]).toBe(Math.max(...strictness));
        }
      }),
      RUNS,
    );
  });

  it('FIRST picks the rule PRIORITY lists first', () => {
    fc.assert(
      fc.property(ruleset, input, (base, record) => {
        const first = evaluate(
          { ...base, hitStrategy: 'FIRST' },
          record,
        ).firedRules;
        const all = evaluate(
          { ...base, hitStrategy: 'PRIORITY' },
          record,
        ).firedRules;
        expect(first).toEqual(all.slice(0, 1));
      }),
      RUNS,
    );
  });

  it('disabling a rule that did not fire changes nothing', () => {
    fc.assert(
      fc.property(ruleset, input, fc.nat(), (content, record, pick) => {
        const before = evaluate(content, record);
        const quiet = content.rules.filter(
          (r) => !before.firedRules.includes(r.id),
        );
        fc.pre(quiet.length > 0);
        const target = quiet[pick % quiet.length].id;
        const after = evaluate(
          {
            ...content,
            rules: content.rules.map((r) =>
              r.id === target ? { ...r, enabled: false } : r,
            ),
          },
          record,
        );
        expect(after).toEqual(before);
      }),
      RUNS,
    );
  });

  it('ignores keys that are not input fields', () => {
    fc.assert(
      fc.property(ruleset, input, fc.string(), (content, record, extra) => {
        expect(evaluate(content, { ...record, zzExtra: extra })).toEqual(
          evaluate(content, record),
        );
      }),
      RUNS,
    );
  });

  it('explain adds a trace but never changes the decision', () => {
    fc.assert(
      fc.property(ruleset, input, (content, record) => {
        const { trace, ...rest } = evaluate(content, record, { explain: true });
        expect(trace).toHaveLength(content.rules.length);
        expect(rest).toEqual(evaluate(content, record));
      }),
      RUNS,
    );
  });
});
