import type {
  Condition,
  InputField,
  RulesetContent,
} from '@rule-studio/shared-types';
import { deepFreeze, loanApproval, oneCondition } from '../test/fixtures.js';
import { evaluate, type Input } from './engine.js';

const fires = (
  field: InputField,
  condition: Omit<Condition, 'type' | 'field'>,
  input: Input,
) => evaluate(oneCondition(field, condition), input).firedRules.length === 1;

const number: InputField = { key: 'n', label: 'N', type: 'NUMBER' };
const text: InputField = { key: 't', label: 'T', type: 'STRING' };
const flag: InputField = { key: 'b', label: 'B', type: 'BOOLEAN' };
const date: InputField = { key: 'd', label: 'D', type: 'DATE' };

describe('operators', () => {
  // [field, operator, value, input value, expected result]
  const table: Array<
    [InputField, Condition['operator'], unknown, unknown, boolean]
  > = [
    [number, 'EQ', 5, 5, true],
    [number, 'EQ', 5, 6, false],
    [number, 'NEQ', 5, 6, true],
    [number, 'NEQ', 5, 5, false],
    [number, 'GT', 5, 6, true],
    [number, 'GT', 5, 5, false],
    [number, 'GTE', 5, 5, true],
    [number, 'LT', 5, 4.99, true],
    [number, 'LT', 5, 5, false],
    [number, 'LTE', 5, 5, true],
    [number, 'BETWEEN', [40, 60], 40, true], // both ends included
    [number, 'BETWEEN', [40, 60], 60, true],
    [number, 'BETWEEN', [40, 60], 60.01, false],
    [number, 'BETWEEN', [40, 60], 39.99, false],
    [number, 'IN', [1, 2, 3], 2, true],
    [number, 'IN', [1, 2, 3], 4, false],
    [number, 'NOT_IN', [1, 2, 3], 4, true],
    [number, 'NOT_IN', [1, 2, 3], 3, false],
    [number, 'EQ', 0, 0, true], // zero is a value, not "missing"
    [text, 'EQ', 'SALARIED', 'SALARIED', true],
    [text, 'EQ', 'SALARIED', 'salaried', false], // case-sensitive
    [text, 'NEQ', 'A', 'B', true],
    [text, 'IN', ['A', 'B'], 'B', true],
    [text, 'NOT_IN', ['A', 'B'], 'C', true],
    [text, 'CONTAINS', 'loan', 'home loan', true],
    [text, 'CONTAINS', 'Loan', 'home loan', false],
    [text, 'STARTS_WITH', 'IN', 'IN-123', true],
    [text, 'STARTS_WITH', 'IN', 'XIN-123', false],
    [flag, 'EQ', true, true, true],
    [flag, 'EQ', true, false, false], // false is a value, not "missing"
    [flag, 'NEQ', true, false, true],
    [date, 'GT', '2000-01-01', '2000-01-02', true],
    [date, 'GT', '2000-01-01', '1999-12-31', false],
    [date, 'LTE', '2000-01-01', '2000-01-01', true],
    [date, 'BETWEEN', ['1990-01-01', '1999-12-31'], '1995-06-15', true],
    [date, 'BETWEEN', ['1990-01-01', '1999-12-31'], '2000-01-01', false],
    [date, 'EQ', '2026-11-23', '2026-11-23', true],
  ];
  it.each(table)(
    '%o %s %o, input %o → %s',
    (field, operator, value, actual, expected) => {
      expect(
        fires(field, { operator, value } as Omit<Condition, 'type' | 'field'>, {
          [field.key]: actual as string,
        }),
      ).toBe(expected);
    },
  );

  describe('missing values (spec 001, rule 2)', () => {
    const missing: Array<[string, Input]> = [
      ['absent', {}],
      ['null', { n: null, t: null, b: null, d: null }],
    ];
    it.each(missing)(
      'when %s: every operator is false except IS_EMPTY',
      (_name, input) => {
        for (const field of [number, text, flag, date]) {
          expect(fires(field, { operator: 'IS_EMPTY' } as never, input)).toBe(
            true,
          );
          expect(
            fires(field, { operator: 'IS_NOT_EMPTY' } as never, input),
          ).toBe(false);
          expect(
            fires(
              field,
              {
                operator: 'EQ',
                value: field === number ? 1 : field === flag ? true : 'x',
              } as never,
              input,
            ),
          ).toBe(false);
        }
      },
    );

    it('treats "" as missing for text, and only for text', () => {
      expect(fires(text, { operator: 'IS_EMPTY' } as never, { t: '' })).toBe(
        true,
      );
      expect(
        fires(text, { operator: 'EQ', value: '' } as never, { t: '' }),
      ).toBe(false);
    });

    it('makes NEQ and NOT_IN false on a missing field: unknown is not "different"', () => {
      expect(fires(number, { operator: 'NEQ', value: 5 } as never, {})).toBe(
        false,
      );
      expect(
        fires(text, { operator: 'NOT_IN', value: ['A'] } as never, {}),
      ).toBe(false);
    });

    it('treats zero, false and whitespace as values', () => {
      expect(fires(number, { operator: 'IS_EMPTY' } as never, { n: 0 })).toBe(
        false,
      );
      expect(
        fires(flag, { operator: 'IS_NOT_EMPTY' } as never, { b: false }),
      ).toBe(true);
      expect(
        fires(text, { operator: 'IS_NOT_EMPTY' } as never, { t: ' ' }),
      ).toBe(true);
    });
  });
});

describe('groups', () => {
  const content = (operator: 'AND' | 'OR'): RulesetContent => ({
    ...oneCondition(number, { operator: 'GT', value: 0 } as never),
    rules: [
      {
        id: 'r1',
        name: 'R',
        priority: 1,
        enabled: true,
        when: {
          type: 'group',
          operator,
          children: [
            { type: 'condition', field: 'n', operator: 'GT', value: 10 },
            {
              type: 'group',
              operator: 'AND',
              children: [
                { type: 'condition', field: 'n', operator: 'LT', value: 0 },
                {
                  type: 'group',
                  operator: 'OR',
                  children: [
                    { type: 'condition', field: 'n', operator: 'EQ', value: 5 },
                  ],
                },
              ],
            },
          ],
        },
        then: { decision: 'APPROVE' },
      },
    ],
  });

  it('combines children with AND and OR, three levels deep', () => {
    expect(evaluate(content('AND'), { n: 20 }).firedRules).toEqual([]);
    expect(evaluate(content('OR'), { n: 20 }).firedRules).toEqual(['r1']);
    expect(evaluate(content('OR'), { n: 5 }).firedRules).toEqual([]);
  });
});

describe('spec 001 evaluation rules on the example ruleset', () => {
  const example = loanApproval();
  const applicant = (overrides: Input): Input => ({
    creditScore: 700,
    annualIncome: 900000,
    debtToIncome: 30,
    employmentType: 'SALARIED',
    hasDefaulted: false,
    dateOfBirth: '1990-05-01',
    ...overrides,
  });
  const decide = (input: Input, content = example) => evaluate(content, input);

  it('rejects a previous defaulter (rule 1 decides first)', () => {
    expect(decide(applicant({ hasDefaulted: true }))).toEqual({
      output: example.rules[0].then,
      firedRules: [example.rules[0].id],
    });
  });

  it('rejects a low score without stable income (nested OR)', () => {
    expect(
      decide(applicant({ creditScore: 550, employmentType: 'STUDENT' })).output
        .decision,
    ).toBe('REJECT');
    expect(
      decide(applicant({ creditScore: 550, annualIncome: 200000 })).output
        .decision,
    ).toBe('REJECT');
  });

  it('refers a high debt ratio', () => {
    expect(decide(applicant({ debtToIncome: 45 })).output).toEqual(
      example.rules[2].then,
    );
  });

  it('approves a strong salaried applicant', () => {
    expect(decide(applicant({ creditScore: 780 })).output).toEqual(
      example.rules[3].then,
    );
  });

  it('falls back to the default when nothing fires', () => {
    expect(decide(applicant({}))).toEqual({
      output: example.defaultAction,
      firedRules: [],
    });
  });

  it('skips disabled rules', () => {
    const content = structuredClone(example);
    content.rules[0].enabled = false;
    expect(
      decide(applicant({ hasDefaulted: true, creditScore: 780 }), content)
        .output.decision,
    ).toBe('APPROVE');
  });

  it('runs rules in priority order, not array order', () => {
    const content = structuredClone(example);
    content.rules.reverse();
    expect(
      decide(applicant({ hasDefaulted: true, debtToIncome: 45 }), content)
        .output.decision,
    ).toBe('REJECT');
  });

  it('FIRST and PRIORITY differ where they should', () => {
    // Debt 45 fires "refer" (priority 3); a score of 780 with debt 45 doesn't approve.
    // Make an applicant that fires an APPROVE rule before a REJECT rule.
    const content = structuredClone(example);
    content.rules[3].priority = 0; // approve now runs first
    const input = applicant({ creditScore: 780, hasDefaulted: true });

    const first = decide(input, { ...content, hitStrategy: 'FIRST' });
    expect(first.output.decision).toBe('APPROVE');
    expect(first.firedRules).toEqual([content.rules[3].id]);

    const priority = decide(input, { ...content, hitStrategy: 'PRIORITY' });
    expect(priority.output.decision).toBe('REJECT'); // strictest wins
    expect(priority.firedRules).toEqual([
      content.rules[3].id,
      content.rules[0].id,
    ]);
  });

  it('PRIORITY takes the reason from the lowest priority among the strictest', () => {
    const content: RulesetContent = {
      ...structuredClone(example),
      hitStrategy: 'PRIORITY',
    };
    // Both REJECT rules fire; rule 1 (priority 1) supplies the reason.
    const result = decide(
      applicant({
        hasDefaulted: true,
        creditScore: 500,
        employmentType: 'UNEMPLOYED',
      }),
      content,
    );
    expect(result.output).toEqual(example.rules[0].then);
    expect(result.firedRules).toEqual([
      example.rules[0].id,
      example.rules[1].id,
    ]);
  });
});

describe('the trace', () => {
  const example = loanApproval();

  it('is only there when asked for', () => {
    expect(evaluate(example, {})).not.toHaveProperty('trace');
    expect(evaluate(example, {}, { explain: true }).trace).toHaveLength(
      example.rules.length,
    );
  });

  it('shows every rule, every condition with its actual value, and why rules were skipped', () => {
    const content = structuredClone(example);
    content.rules[2].enabled = false;
    const { trace } = evaluate(
      content,
      { hasDefaulted: true, creditScore: 550 },
      { explain: true },
    );
    expect(trace?.map((t) => t.status)).toEqual([
      'fired',
      'notReached',
      'disabled',
      'notReached',
    ]);
    expect(trace?.[0].when?.children[0]).toEqual({
      type: 'condition',
      field: 'hasDefaulted',
      operator: 'EQ',
      expected: true,
      actual: true,
      missing: false,
      result: true,
    });
  });

  it('evaluates every condition, even after the answer is known (no short-circuit)', () => {
    const content: RulesetContent = {
      ...loanApproval(),
      hitStrategy: 'PRIORITY',
    };
    // Rule 2: creditScore LT 600 is false, so the AND is already false; the OR inside still gets results.
    const { trace } = evaluate(
      content,
      { creditScore: 700, annualIncome: 100000 },
      { explain: true },
    );
    const or = trace?.[1].when?.children[1];
    expect(or).toMatchObject({ type: 'group', operator: 'OR', result: true });
    expect(
      (or as { children: Array<{ result: boolean; missing: boolean }> })
        .children,
    ).toEqual([
      expect.objectContaining({
        field: 'annualIncome',
        actual: 100000,
        result: true,
      }),
      expect.objectContaining({
        field: 'employmentType',
        missing: true,
        result: false,
      }),
    ]);
    expect(trace?.[1]).toMatchObject({
      status: 'notFired',
      when: { result: false },
    });
  });

  it('does not change the decision', () => {
    const input = {
      creditScore: 780,
      employmentType: 'SALARIED',
      debtToIncome: 10,
    };
    const { trace, ...withTrace } = evaluate(example, input, { explain: true });
    expect(trace).toBeDefined();
    expect(withTrace).toEqual(evaluate(example, input));
  });
});

describe('determinism', () => {
  it('never changes its arguments and needs no clock or randomness', () => {
    const content = deepFreeze(loanApproval());
    const input = deepFreeze({ creditScore: 640, debtToIncome: 50 });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('the engine read the clock');
    });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the engine used randomness');
    });
    const first = evaluate(content, input, { explain: true });
    expect(evaluate(content, input, { explain: true })).toEqual(first);
    now.mockRestore();
    random.mockRestore();
  });
});
