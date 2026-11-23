import type {
  Action,
  Condition,
  ConditionGroup,
  FieldType,
  InputField,
  LogicalOperator,
  Rule,
  RulesetContent,
} from '@rule-studio/shared-types';
import { operatorsFor, type Operator } from '@rule-studio/ruleset-validation';

// Shapes and helpers the editor works with. The draft itself is RulesetContent,
// generated from the contract; nothing here redefines it.

export type { Operator };
export type Value = string | number | boolean;

// Any group at any level. The contract types the three levels separately
// (ConditionGroup, ...Level2, ...Level3) to cap nesting at 3; the editor
// treats them alike and enforces the cap itself.
export interface Group {
  type: 'group';
  operator: LogicalOperator;
  children: Array<Condition | Group>;
}

// A node inside a rule's `when`, addressed by child indexes from the top group:
// [] is the top group, [2] its third child, [2, 0] that child's first child.
export type NodePath = number[];

export const MAX_GROUP_DEPTH = 3;

// The top group is depth 1, so a group at `path` sits at depth path.length + 1.
export const canAddGroupInside = (groupPath: NodePath) =>
  groupPath.length + 1 < MAX_GROUP_DEPTH;

export function nodeAt(
  when: ConditionGroup,
  path: NodePath,
): Condition | Group {
  let node: Condition | Group = when as Group;
  for (const index of path) {
    if (node.type !== 'group') throw new Error(`No group at ${path.join('/')}`);
    node = node.children[index];
    if (!node) throw new Error(`Nothing at ${path.join('/')}`);
  }
  return node;
}

export function groupAt(when: ConditionGroup, path: NodePath): Group {
  const node = nodeAt(when, path);
  if (node.type !== 'group')
    throw new Error(`Not a group at ${path.join('/')}`);
  return node;
}

export function conditionAt(when: ConditionGroup, path: NodePath): Condition {
  const node = nodeAt(when, path);
  if (node.type !== 'condition')
    throw new Error(`Not a condition at ${path.join('/')}`);
  return node;
}

// What value an operator takes: one, two (BETWEEN), a list (IN), or none.
export type ValueShape = 'single' | 'pair' | 'list' | 'none';

export function valueShape(operator: Operator): ValueShape {
  switch (operator) {
    case 'BETWEEN':
      return 'pair';
    case 'IN':
    case 'NOT_IN':
      return 'list';
    case 'IS_EMPTY':
    case 'IS_NOT_EMPTY':
      return 'none';
    default:
      return 'single';
  }
}

const today = () => new Date().toISOString().slice(0, 10);

// A sensible starting value for a field, used when a condition is created or
// its field or operator changes.
export function startingValue(field: InputField): Value {
  switch (field.type) {
    case 'NUMBER':
      return 0;
    case 'BOOLEAN':
      return true;
    case 'DATE':
      return today();
    case 'STRING':
      return field.allowedValues?.[0] ?? '';
  }
}

// Builds a condition with the given field and operator, keeping as much of
// `previous` as still fits: its first value seeds the new shape.
export function buildCondition(
  field: InputField,
  operator: Operator,
  previous?: unknown,
): Condition {
  const seed = (Array.isArray(previous) ? previous[0] : previous) as
    Value | undefined;
  const value: Value =
    seed === undefined || seed === null ? startingValue(field) : seed;
  const base = { type: 'condition' as const, field: field.key };
  switch (valueShape(operator)) {
    case 'none':
      return { ...base, operator } as Condition;
    case 'pair':
      return { ...base, operator, value: [value, value] } as Condition;
    case 'list':
      return { ...base, operator, value: [value] } as Condition;
    case 'single':
      return { ...base, operator, value } as Condition;
  }
}

export function newCondition(fields: InputField[]): Condition {
  const field = fields[0];
  return buildCondition(field, operatorsFor(field.type)[0]);
}

export function newRule(content: RulesetContent): Rule {
  const priority = Math.max(0, ...content.rules.map((r) => r.priority)) + 1;
  return {
    id: crypto.randomUUID(),
    name: `Rule ${priority}`,
    priority,
    enabled: true,
    when: {
      type: 'group',
      operator: 'AND',
      children: [newCondition(content.inputFields)],
    },
    then: { decision: 'APPROVE' },
  };
}

// A new field with a key no other field uses (field1, field2, ...).
export function newField(
  fields: InputField[],
  type: FieldType = 'STRING',
): InputField {
  const taken = new Set(fields.map((f) => f.key));
  let n = fields.length + 1;
  while (taken.has(`field${n}`)) n++;
  return { key: `field${n}`, label: `Field ${n}`, type };
}

export type ActionPatch = Partial<Action>;
