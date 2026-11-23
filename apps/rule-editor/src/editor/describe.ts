import type {
  Condition,
  ConditionGroup,
  InputField,
} from '@rule-studio/shared-types';
import type { Group, Operator } from './model';

// Words for operators, used in the builder's select and in one-line summaries.
export const OPERATOR_LABEL: Record<Operator, string> = {
  EQ: 'is',
  NEQ: 'is not',
  GT: 'is greater than',
  GTE: 'is at least',
  LT: 'is less than',
  LTE: 'is at most',
  BETWEEN: 'is between',
  IN: 'is one of',
  NOT_IN: 'is not one of',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts with',
  IS_EMPTY: 'is empty',
  IS_NOT_EMPTY: 'is not empty',
};

// A missing value (being typed, or cleared) shows as a gap, not "null".
const format = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '…'
    : typeof value === 'string'
      ? `"${value}"`
      : String(value);

function describeCondition(condition: Condition, fields: InputField[]): string {
  const label =
    fields.find((f) => f.key === condition.field)?.label ?? condition.field;
  const words = `${label} ${OPERATOR_LABEL[condition.operator]}`;
  if (!('value' in condition)) return words;
  const value = condition.value as unknown;
  if (condition.operator === 'BETWEEN' && Array.isArray(value))
    return `${words} ${format(value[0])} and ${format(value[1])}`;
  if (Array.isArray(value)) return `${words} ${value.map(format).join(', ')}`;
  return `${words} ${format(value)}`;
}

// "Credit score is less than 600 AND (Employment type is "UNEMPLOYED" OR ...)"
export function describeGroup(
  group: ConditionGroup | Group,
  fields: InputField[],
  nested = false,
): string {
  const parts = (group as Group).children.map((child) =>
    child.type === 'group'
      ? describeGroup(child, fields, true)
      : describeCondition(child, fields),
  );
  const text = parts.join(` ${group.operator} `);
  return nested && parts.length > 1 ? `(${text})` : text;
}
