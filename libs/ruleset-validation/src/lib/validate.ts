import type {
  Condition,
  ConditionGroup,
  ConditionGroupLevel2,
  ConditionGroupLevel3,
  FieldType,
  InputField,
  RulesetContent,
  ValidationProblem,
} from '@rule-studio/shared-types';

// Spec 001, "Validation split": the JSON Schema checks structure; these are the
// cross-field rules it can't express. Shared by the API (spec 003) and the rule
// editor (spec 005), so the editor shows exactly what the API enforces.
//
// Input must already be structurally valid (it passed the JSON Schema).
// Pure TypeScript: no Node or browser APIs, so it runs anywhere.

export type Operator = Condition['operator'];
type Group = ConditionGroup | ConditionGroupLevel2 | ConditionGroupLevel3;

// Which operators each field type allows (spec 001, operator table).
export const OPERATORS: Record<FieldType, readonly Operator[]> = {
  NUMBER: [
    'EQ',
    'NEQ',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'BETWEEN',
    'IN',
    'NOT_IN',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
  STRING: [
    'EQ',
    'NEQ',
    'IN',
    'NOT_IN',
    'CONTAINS',
    'STARTS_WITH',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
  BOOLEAN: ['EQ', 'NEQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  DATE: [
    'EQ',
    'NEQ',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'BETWEEN',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
};

// The operators a field of this type may use, in the order the editor offers them.
export function operatorsFor(type: FieldType): readonly Operator[] {
  return OPERATORS[type];
}

const TYPE_NAME: Record<FieldType, string> = {
  NUMBER: 'a number',
  STRING: 'text',
  BOOLEAN: 'true or false',
  DATE: 'a date (YYYY-MM-DD)',
};

// A real calendar date in YYYY-MM-DD form (rejects 2026-02-30).
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function matchesType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'NUMBER':
      return typeof value === 'number' && Number.isFinite(value);
    case 'STRING':
      return typeof value === 'string';
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'DATE':
      return isIsoDate(value);
  }
}

// Escapes a key for a JSON Pointer segment (RFC 6901). Keys here are plain, but be correct.
const segment = (key: string | number) =>
  String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const pointer = (...parts: Array<string | number>) =>
  '/' + parts.map(segment).join('/');

export function validateRulesetContent(
  content: RulesetContent,
): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const add = (path: string, message: string) =>
    problems.push({ path, message });

  // Input fields: unique keys; allowedValues only on text fields.
  const fields = new Map<string, InputField>();
  content.inputFields.forEach((field, i) => {
    if (fields.has(field.key)) {
      add(
        pointer('inputFields', i, 'key'),
        `Another input field already uses the key "${field.key}".`,
      );
    } else {
      fields.set(field.key, field);
    }
    if (field.allowedValues && field.type !== 'STRING') {
      add(
        pointer('inputFields', i, 'allowedValues'),
        'Only text fields can have a list of allowed values.',
      );
    }
  });

  // Rules: unique priorities and ids.
  const priorities = new Map<number, number>();
  const ids = new Set<string>();
  content.rules.forEach((rule, i) => {
    const other = priorities.get(rule.priority);
    if (other !== undefined) {
      add(
        pointer('rules', i, 'priority'),
        `Rule "${content.rules[other].name}" already has priority ${rule.priority}.`,
      );
    } else {
      priorities.set(rule.priority, i);
    }
    if (ids.has(rule.id))
      add(pointer('rules', i, 'id'), 'Another rule already has this id.');
    ids.add(rule.id);

    checkGroup(rule.when, ['rules', i, 'when']);
  });

  function checkGroup(group: Group, path: Array<string | number>): void {
    group.children.forEach((child, j) => {
      const childPath = [...path, 'children', j];
      if (child.type === 'group') checkGroup(child, childPath);
      else checkCondition(child, childPath);
    });
  }

  function checkCondition(
    condition: Condition,
    path: Array<string | number>,
  ): void {
    const field = fields.get(condition.field);
    if (!field) {
      add(
        pointer(...path, 'field'),
        `There is no input field "${condition.field}".`,
      );
      return; // nothing else can be judged without the field's type
    }
    if (!OPERATORS[field.type].includes(condition.operator)) {
      add(
        pointer(...path, 'operator'),
        `${condition.operator} can't be used on "${field.label}", which is ${TYPE_NAME[field.type]}.`,
      );
      return;
    }
    if (!('value' in condition)) return; // IS_EMPTY / IS_NOT_EMPTY take no value

    const values: unknown[] = Array.isArray(condition.value)
      ? condition.value
      : [condition.value];
    const valuePath = (k: number) =>
      Array.isArray(condition.value)
        ? pointer(...path, 'value', k)
        : pointer(...path, 'value');

    let allTyped = true;
    values.forEach((value, k) => {
      if (!matchesType(value, field.type)) {
        allTyped = false;
        add(valuePath(k), `"${field.label}" needs ${TYPE_NAME[field.type]}.`);
      } else if (
        field.type === 'STRING' &&
        field.allowedValues &&
        !field.allowedValues.includes(value as string)
      ) {
        add(
          valuePath(k),
          `"${String(value)}" isn't one of the allowed values for "${field.label}".`,
        );
      }
    });

    if (condition.operator === 'BETWEEN' && allTyped) {
      const [min, max] = condition.value;
      // Numbers compare as numbers; ISO dates compare correctly as strings.
      if (min > max)
        add(
          pointer(...path, 'value'),
          `The first value (${min}) is bigger than the second (${max}).`,
        );
    }
  }

  return problems;
}
