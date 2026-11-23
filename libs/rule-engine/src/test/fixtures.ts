import type {
  Condition,
  InputField,
  Rule,
  RulesetContent,
} from '@rule-studio/shared-types';
// contracts/ isn't an Nx project, so the boundary rule can't know it's allowed;
// it's the shared source of truth, and this is test-only.
// eslint-disable-next-line @nx/enforce-module-boundaries
import example from '../../../../contracts/examples/loan-approval.json' with { type: 'json' };

export function loanApproval(): RulesetContent {
  const { schemaVersion, inputFields, hitStrategy, defaultAction, rules } =
    structuredClone(example) as unknown as RulesetContent;
  return { schemaVersion, inputFields, hitStrategy, defaultAction, rules };
}

// A one-rule ruleset with one field, for checking a single operator.
export function oneCondition(
  field: InputField,
  condition: Omit<Condition, 'type' | 'field'>,
): RulesetContent {
  const rule: Rule = {
    id: 'r1',
    name: 'Only rule',
    priority: 1,
    enabled: true,
    when: {
      type: 'group',
      operator: 'AND',
      children: [
        { type: 'condition', field: field.key, ...condition } as Condition,
      ],
    },
    then: { decision: 'APPROVE' },
  };
  return {
    schemaVersion: 1,
    inputFields: [field],
    hitStrategy: 'FIRST',
    defaultAction: { decision: 'REFER' },
    rules: [rule],
  };
}

// Deep-freezes a value, so a test fails if the engine ever writes to its input.
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
