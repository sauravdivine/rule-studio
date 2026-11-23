import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RulesetContent } from '@rule-studio/shared-types';
import { isIsoDate, validateRulesetContent } from './validate.js';

// Spec 001's example ruleset: valid, and the base every failing example changes.
const example = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      '../../../../contracts/examples/loan-approval.json',
    ),
    'utf8',
  ),
) as RulesetContent;

// A copy of the example with one change, so each test shows exactly what breaks.
function withChange(change: (content: RulesetContent) => void): RulesetContent {
  const copy = structuredClone(example);
  change(copy);
  return copy;
}

// The first condition of the first rule, the usual place to break something.
const firstCondition = (content: RulesetContent) =>
  content.rules[0].when.children[0] as Record<string, unknown>;

describe('validateRulesetContent', () => {
  it('finds no problems in the example ruleset', () => {
    expect(validateRulesetContent(example)).toEqual([]);
  });

  // One failing example per cross-field rule in spec 001.

  it('rejects a condition on a field that does not exist', () => {
    const problems = validateRulesetContent(
      withChange((c) => (firstCondition(c)['field'] = 'income')),
    );
    expect(problems).toEqual([
      {
        path: '/rules/0/when/children/0/field',
        message: 'There is no input field "income".',
      },
    ]);
  });

  it('rejects an operator the field type does not allow', () => {
    // hasDefaulted is BOOLEAN; GT only works on numbers and dates
    const problems = validateRulesetContent(
      withChange((c) => (firstCondition(c)['operator'] = 'GT')),
    );
    expect(problems).toEqual([
      {
        path: '/rules/0/when/children/0/operator',
        message:
          'GT can\'t be used on "Previous default", which is true or false.',
      },
    ]);
  });

  it('rejects a value of the wrong type', () => {
    const problems = validateRulesetContent(
      withChange((c) => (firstCondition(c)['value'] = 'yes')),
    );
    expect(problems).toEqual([
      {
        path: '/rules/0/when/children/0/value',
        message: '"Previous default" needs true or false.',
      },
    ]);
  });

  it('rejects a date that is not a real YYYY-MM-DD date', () => {
    const content = withChange((c) => {
      c.rules[0].when.children[0] = {
        type: 'condition',
        field: 'dateOfBirth',
        operator: 'GT',
        value: '2026-02-30',
      };
    });
    expect(validateRulesetContent(content)).toEqual([
      {
        path: '/rules/0/when/children/0/value',
        message: '"Date of birth" needs a date (YYYY-MM-DD).',
      },
    ]);
  });

  it('rejects BETWEEN with the bigger value first', () => {
    const content = withChange((c) => {
      c.rules[0].when.children[0] = {
        type: 'condition',
        field: 'creditScore',
        operator: 'BETWEEN',
        value: [700, 600],
      };
    });
    expect(validateRulesetContent(content)).toEqual([
      {
        path: '/rules/0/when/children/0/value',
        message: 'The first value (700) is bigger than the second (600).',
      },
    ]);
  });

  it('rejects BETWEEN on dates in the wrong order', () => {
    const content = withChange((c) => {
      c.rules[0].when.children[0] = {
        type: 'condition',
        field: 'dateOfBirth',
        operator: 'BETWEEN',
        value: ['2001-01-01', '1990-01-01'],
      };
    });
    expect(validateRulesetContent(content)).toHaveLength(1);
  });

  it('rejects two rules with the same priority', () => {
    const content = withChange(
      (c) => (c.rules[1].priority = c.rules[0].priority),
    );
    expect(validateRulesetContent(content)).toEqual([
      {
        path: '/rules/1/priority',
        message: `Rule "${example.rules[0].name}" already has priority ${example.rules[0].priority}.`,
      },
    ]);
  });

  it('rejects two input fields with the same key', () => {
    const content = withChange((c) =>
      c.inputFields.push({ ...c.inputFields[0], label: 'Copy' }),
    );
    expect(validateRulesetContent(content)).toEqual([
      {
        path: `/inputFields/${example.inputFields.length}/key`,
        message: 'Another input field already uses the key "creditScore".',
      },
    ]);
  });

  it("rejects a value outside the field's allowed values, in EQ and in IN", () => {
    const content = withChange((c) => {
      c.rules[0].when.children = [
        {
          type: 'condition',
          field: 'employmentType',
          operator: 'EQ',
          value: 'RETIRED',
        },
        {
          type: 'condition',
          field: 'employmentType',
          operator: 'IN',
          value: ['SALARIED', 'PIRATE'],
        },
      ];
    });
    expect(validateRulesetContent(content)).toEqual([
      {
        path: '/rules/0/when/children/0/value',
        message:
          '"RETIRED" isn\'t one of the allowed values for "Employment type".',
      },
      {
        path: '/rules/0/when/children/1/value/1',
        message:
          '"PIRATE" isn\'t one of the allowed values for "Employment type".',
      },
    ]);
  });

  // Beyond spec 001's list, but needed for the rest to make sense.

  it('rejects allowed values on a field that is not text', () => {
    const content = withChange(
      (c) => (c.inputFields[0].allowedValues = ['1', '2']),
    );
    expect(validateRulesetContent(content)).toEqual([
      {
        path: '/inputFields/0/allowedValues',
        message: 'Only text fields can have a list of allowed values.',
      },
    ]);
  });

  it('rejects two rules with the same id (the engine reports fired rules by id)', () => {
    const content = withChange((c) => (c.rules[1].id = c.rules[0].id));
    expect(validateRulesetContent(content)).toEqual([
      { path: '/rules/1/id', message: 'Another rule already has this id.' },
    ]);
  });

  it('finds problems inside nested groups, with the full path', () => {
    const content = withChange((c) => {
      c.rules[0].when.children = [
        {
          type: 'group',
          operator: 'OR',
          children: [
            {
              type: 'group',
              operator: 'AND',
              children: [
                { type: 'condition', field: 'nope', operator: 'IS_EMPTY' },
              ],
            },
          ],
        },
      ];
    });
    expect(validateRulesetContent(content)).toEqual([
      {
        path: '/rules/0/when/children/0/children/0/children/0/field',
        message: 'There is no input field "nope".',
      },
    ]);
  });

  it('accepts IS_EMPTY, which takes no value, on every type', () => {
    const content = withChange((c) => {
      c.rules[0].when.children = c.inputFields.map((f) => ({
        type: 'condition' as const,
        field: f.key,
        operator: 'IS_EMPTY' as const,
      }));
    });
    expect(validateRulesetContent(content)).toEqual([]);
  });
});

describe('isIsoDate', () => {
  it.each(['2026-11-22', '2024-02-29'])('accepts %s', (value) =>
    expect(isIsoDate(value)).toBe(true),
  );
  it.each([
    '2026-02-30',
    '2025-02-29',
    '22-11-2026',
    '2026-11-22T10:00:00Z',
    20261122,
  ])('rejects %s', (value) => expect(isIsoDate(value)).toBe(false));
});
