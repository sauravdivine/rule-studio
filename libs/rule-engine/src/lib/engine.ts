import type {
  Action,
  Condition,
  ConditionTrace,
  Decision,
  FieldType,
  GroupTrace,
  InputField,
  Rule,
  RuleTrace,
  RulesetContent,
} from '@rule-studio/shared-types';

// The rule engine (spec 006): one ruleset and one input record in, one decision
// out. A pure function: no I/O, no clock, no randomness, and it never changes
// its arguments, so the same call always gives the same answer, in the API, in
// a browser or in a test.
//
// It implements spec 001's evaluation rules:
//   1. Skip disabled rules; evaluate the rest in ascending priority.
//   2. A condition on a missing field is false, except IS_EMPTY (true).
//   3. FIRST: the first rule whose `when` is true decides.
//   4. PRIORITY: every rule runs; the strictest decision among those that fired
//      wins (REJECT > REFER > APPROVE), and the lowest priority of those
//      supplies the reason.
//   5. Nothing fired: defaultAction.
//   6. Result: { output, firedRules }.

export type InputValue = string | number | boolean | null | undefined;
export type Input = Readonly<Record<string, InputValue>>;

export interface EngineResult {
  output: Action;
  // Ids of every rule that fired, in evaluation order.
  firedRules: string[];
  // Present when explain is true.
  trace?: RuleTrace[];
}

export const STRICTNESS: Record<Decision, number> = {
  APPROVE: 0,
  REFER: 1,
  REJECT: 2,
};

// Missing: absent, null, or (for text) an empty string (spec 006).
export function isMissing(
  value: InputValue,
  type: FieldType | undefined,
): boolean {
  return (
    value === undefined || value === null || (type === 'STRING' && value === '')
  );
}

type Group = {
  type: 'group';
  operator: 'AND' | 'OR';
  children: Array<Condition | Group>;
};

export function evaluate(
  content: RulesetContent,
  input: Input,
  options: { explain?: boolean } = {},
): EngineResult {
  const fields = new Map<string, InputField>(
    content.inputFields.map((f) => [f.key, f]),
  );
  // Sorted copy: never reorder the caller's array.
  const rules = [...content.rules].sort((a, b) => a.priority - b.priority);
  const fired: Rule[] = [];
  const trace: RuleTrace[] = [];

  for (const rule of rules) {
    const entry: RuleTrace = {
      ruleId: rule.id,
      name: rule.name,
      priority: rule.priority,
      status: 'notFired',
    };
    if (!rule.enabled) {
      entry.status = 'disabled';
    } else if (content.hitStrategy === 'FIRST' && fired.length > 0) {
      entry.status = 'notReached'; // FIRST already has its answer
    } else {
      const when = evaluateGroup(rule.when as Group, fields, input);
      entry.when = when;
      if (when.result) {
        entry.status = 'fired';
        fired.push(rule);
      }
    }
    trace.push(entry);
  }

  const result: EngineResult = {
    output: { ...decide(content, fired) },
    firedRules: fired.map((r) => r.id),
  };
  if (options.explain) result.trace = trace;
  return result;
}

function decide(content: RulesetContent, fired: Rule[]): Action {
  if (fired.length === 0) return content.defaultAction;
  if (content.hitStrategy === 'FIRST') return fired[0].then;
  // PRIORITY: `fired` is already in ascending priority, so the first rule with
  // the strictest decision is the one with the lowest priority.
  const strictest = Math.max(...fired.map((r) => STRICTNESS[r.then.decision]));
  const winner = fired.find((r) => STRICTNESS[r.then.decision] === strictest);
  return (winner as Rule).then;
}

// Every child is evaluated, even when the group's answer is already known
// (no short-circuit), so the trace has a result for every condition (spec 006).
function evaluateGroup(
  group: Group,
  fields: Map<string, InputField>,
  input: Input,
): GroupTrace {
  const children = group.children.map((child) =>
    child.type === 'group'
      ? evaluateGroup(child, fields, input)
      : evaluateCondition(child, fields, input),
  );
  const results = children.map((c) => c.result);
  return {
    type: 'group',
    operator: group.operator,
    result:
      group.operator === 'AND' ? results.every(Boolean) : results.some(Boolean),
    children,
  };
}

function evaluateCondition(
  condition: Condition,
  fields: Map<string, InputField>,
  input: Input,
): ConditionTrace {
  const field = fields.get(condition.field);
  const raw = Object.hasOwn(input, condition.field)
    ? input[condition.field]
    : undefined;
  const missing = isMissing(raw, field?.type);
  const expected =
    'value' in condition ? (condition.value as unknown) : undefined;
  const trace: ConditionTrace = {
    type: 'condition',
    field: condition.field,
    operator: condition.operator,
    missing,
    result: compare(
      condition.operator,
      missing ? undefined : raw,
      expected,
      missing,
    ),
  };
  if (expected !== undefined) trace.expected = expected;
  if (!missing) trace.actual = raw;
  return trace;
}

function compare(
  operator: Condition['operator'],
  actual: InputValue,
  expected: unknown,
  missing: boolean,
): boolean {
  // Spec 001, rule 2: on a missing field only IS_EMPTY is true. That includes
  // NEQ and NOT_IN: "unknown" isn't the same as "different" (like SQL's NULL).
  if (operator === 'IS_EMPTY') return missing;
  if (operator === 'IS_NOT_EMPTY') return !missing;
  if (missing) return false;

  // Numbers compare as numbers; dates are YYYY-MM-DD strings, which sort in
  // date order. Text comparison is case-sensitive (spec 006, decision 4).
  const a = actual as string | number | boolean;
  switch (operator) {
    case 'EQ':
      return a === expected;
    case 'NEQ':
      return a !== expected;
    case 'GT':
      return a > (expected as string | number);
    case 'GTE':
      return a >= (expected as string | number);
    case 'LT':
      return a < (expected as string | number);
    case 'LTE':
      return a <= (expected as string | number);
    case 'BETWEEN': {
      const [min, max] = expected as [string | number, string | number];
      return a >= min && a <= max; // both ends included
    }
    case 'IN':
      return (expected as unknown[]).includes(a);
    case 'NOT_IN':
      return !(expected as unknown[]).includes(a);
    case 'CONTAINS':
      return typeof a === 'string' && a.includes(expected as string);
    case 'STARTS_WITH':
      return typeof a === 'string' && a.startsWith(expected as string);
  }
}
