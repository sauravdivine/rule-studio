import { produce } from 'immer';
import type {
  Condition,
  FieldType,
  InputField,
  LogicalOperator,
  Rule,
  RulesetContent,
} from '@rule-studio/shared-types';
import { operatorsFor } from '@rule-studio/ruleset-validation';
import { deepEqual } from './deep-equal';
import {
  buildCondition,
  canAddGroupInside,
  conditionAt,
  groupAt,
  newCondition,
  newField,
  newRule,
  type ActionPatch,
  type Group,
  type NodePath,
  type Operator,
  type Value,
} from './model';

// The editor's state (spec 005, decision 3): the draft being edited and the
// last version the server has. Every change goes through this reducer, so the
// rules that keep a draft consistent live in one testable place.
//
// Immer: each case below looks like it mutates `draft`, but runs inside
// produce(), which records the changes on a proxy and builds a new, frozen
// object. Untouched parts (other rules, other fields) keep their identity, so
// memoised rows that didn't change don't re-render.

export interface EditorState {
  draft: RulesetContent;
  saved: RulesetContent;
}

export type EditorAction =
  // Loading, saving and restoring replace both the draft and the saved copy.
  | { type: 'load'; content: RulesetContent }
  | { type: 'addField' }
  | {
      type: 'updateField';
      index: number;
      patch: Partial<Pick<InputField, 'key' | 'label'>>;
    }
  | { type: 'setFieldType'; index: number; fieldType: FieldType }
  | { type: 'setAllowedValues'; index: number; values: string[] | undefined }
  | { type: 'removeField'; index: number }
  | { type: 'setHitStrategy'; hitStrategy: RulesetContent['hitStrategy'] }
  | { type: 'setDefaultAction'; patch: ActionPatch }
  | { type: 'addRule' }
  | {
      type: 'updateRule';
      rule: number;
      patch: Partial<
        Pick<Rule, 'name' | 'description' | 'priority' | 'enabled'>
      >;
    }
  | { type: 'setThen'; rule: number; patch: ActionPatch }
  | { type: 'removeRule'; rule: number }
  | { type: 'addCondition'; rule: number; group: NodePath }
  | { type: 'addGroup'; rule: number; group: NodePath }
  | { type: 'removeNode'; rule: number; path: NodePath }
  | {
      type: 'setGroupOperator';
      rule: number;
      group: NodePath;
      operator: LogicalOperator;
    }
  | { type: 'setConditionField'; rule: number; path: NodePath; field: string }
  | {
      type: 'setConditionOperator';
      rule: number;
      path: NodePath;
      operator: Operator;
    }
  | {
      type: 'setConditionValue';
      rule: number;
      path: NodePath;
      value: Value | Value[];
    };

export function initEditor(content: RulesetContent): EditorState {
  return { draft: content, saved: content };
}

export const isDirty = (state: EditorState) =>
  !deepEqual(state.draft, state.saved);

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  if (action.type === 'load') return initEditor(action.content);
  const draft = produce(state.draft, (d) => applyChange(d, action));
  return draft === state.draft ? state : { ...state, draft };
}

function applyChange(
  d: RulesetContent,
  action: Exclude<EditorAction, { type: 'load' }>,
): void {
  const fieldByKey = (key: string) => d.inputFields.find((f) => f.key === key);
  const when = (rule: number) => d.rules[rule].when;

  switch (action.type) {
    case 'addField':
      d.inputFields.push(newField(d.inputFields));
      return;

    case 'updateField':
      Object.assign(d.inputFields[action.index], action.patch);
      return;

    case 'setFieldType': {
      const field = d.inputFields[action.index];
      field.type = action.fieldType;
      // Allowed values are a text-only feature (spec 001).
      if (action.fieldType !== 'STRING') delete field.allowedValues;
      return;
    }

    case 'setAllowedValues': {
      const field = d.inputFields[action.index];
      if (action.values && action.values.length > 0)
        field.allowedValues = action.values;
      else delete field.allowedValues;
      return;
    }

    case 'removeField':
      // Conditions that used it now point at an unknown field; the problems
      // panel shows each one (the screen warns before removing).
      d.inputFields.splice(action.index, 1);
      return;

    case 'setHitStrategy':
      d.hitStrategy = action.hitStrategy;
      return;

    case 'setDefaultAction':
      setAction(d.defaultAction, action.patch);
      return;

    case 'addRule':
      d.rules.push(newRule(d));
      return;

    case 'updateRule': {
      const rule = d.rules[action.rule];
      Object.assign(rule, action.patch);
      if (action.patch.description === '') delete rule.description;
      return;
    }

    case 'setThen':
      setAction(d.rules[action.rule].then, action.patch);
      return;

    case 'removeRule':
      d.rules.splice(action.rule, 1);
      return;

    case 'addCondition':
      groupAt(when(action.rule), action.group).children.push(
        newCondition(d.inputFields),
      );
      return;

    case 'addGroup': {
      if (!canAddGroupInside(action.group)) return; // the contract allows 3 levels
      const group: Group = {
        type: 'group',
        operator: 'AND',
        children: [newCondition(d.inputFields)],
      };
      (groupAt(when(action.rule), action.group).children as unknown[]).push(
        group,
      );
      return;
    }

    case 'removeNode': {
      if (action.path.length === 0) return; // the top group always stays
      removeNode(when(action.rule) as Group, action.path);
      return;
    }

    case 'setGroupOperator':
      groupAt(when(action.rule), action.group).operator = action.operator;
      return;

    case 'setConditionField': {
      const field = fieldByKey(action.field);
      if (!field) return;
      const old = conditionAt(when(action.rule), action.path);
      const oldType = fieldByKey(old.field)?.type;
      // Keep the operator if the new field's type allows it; otherwise the first one it does.
      const operator = operatorsFor(field.type).includes(old.operator)
        ? old.operator
        : operatorsFor(field.type)[0];
      // A value only carries over between fields of the same type.
      const previous =
        oldType === field.type && 'value' in old ? old.value : undefined;
      replaceCondition(
        when(action.rule) as Group,
        action.path,
        buildCondition(field, operator, previous),
      );
      return;
    }

    case 'setConditionOperator': {
      const old = conditionAt(when(action.rule), action.path);
      const field = fieldByKey(old.field);
      if (!field) return;
      // Reshape the value for the new operator: one, two (BETWEEN), a list (IN), or none.
      const previous = 'value' in old ? old.value : undefined;
      replaceCondition(
        when(action.rule) as Group,
        action.path,
        buildCondition(field, action.operator, previous),
      );
      return;
    }

    case 'setConditionValue': {
      const condition = conditionAt(
        when(action.rule),
        action.path,
      ) as Condition & { value?: unknown };
      if ('value' in condition) condition.value = action.value;
      return;
    }
  }
}

function setAction(
  target: { decision: string; reason?: string },
  patch: ActionPatch,
): void {
  if (patch.decision) target.decision = patch.decision;
  if (patch.reason !== undefined) {
    if (patch.reason === '') delete target.reason;
    else target.reason = patch.reason;
  }
}

function replaceCondition(
  top: Group,
  path: NodePath,
  condition: Condition,
): void {
  const parent = path
    .slice(0, -1)
    .reduce<Group>((group, i) => group.children[i] as Group, top);
  parent.children[path[path.length - 1]] = condition;
}

// Removes a node. A nested group left with no children is removed too, because
// the contract needs at least one child per group; the top group keeps its last
// child (the screen disables removing it).
function removeNode(top: Group, path: NodePath): void {
  const parentPath = path.slice(0, -1);
  const parent = parentPath.reduce<Group>(
    (group, i) => group.children[i] as Group,
    top,
  );
  if (parentPath.length === 0 && parent.children.length === 1) return;
  parent.children.splice(path[path.length - 1], 1);
  if (parent.children.length === 0) removeNode(top, parentPath);
}
