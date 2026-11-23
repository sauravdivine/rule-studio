import { describe, expect, it } from 'vitest';
import { loanApproval } from '../test/fixtures';
import { describeGroup } from './describe';
import { conditionAt, groupAt } from './model';
import { draftProblems } from './problems';
import {
  editorReducer,
  initEditor,
  isDirty,
  type EditorAction,
  type EditorState,
} from './reducer';

const example = loanApproval;

const run = (
  actions: EditorAction[],
  state: EditorState = initEditor(example()),
) => actions.reduce(editorReducer, state);

describe('editorReducer', () => {
  it('starts clean and becomes dirty on a change', () => {
    const state = initEditor(example());
    expect(isDirty(state)).toBe(false);
    const changed = run(
      [{ type: 'setHitStrategy', hitStrategy: 'PRIORITY' }],
      state,
    );
    expect(isDirty(changed)).toBe(true);
  });

  it('is clean again when a change is undone by hand', () => {
    const state = run([
      { type: 'setHitStrategy', hitStrategy: 'PRIORITY' },
      { type: 'setHitStrategy', hitStrategy: 'FIRST' },
    ]);
    expect(isDirty(state)).toBe(false);
  });

  it('never mutates the previous state, and keeps untouched parts identical (Immer)', () => {
    const before = initEditor(example());
    const snapshot = JSON.stringify(before.draft);
    const after = run(
      [{ type: 'setThen', rule: 0, patch: { reason: 'Changed' } }],
      before,
    );
    expect(JSON.stringify(before.draft)).toBe(snapshot);
    expect(after.draft.rules[0]).not.toBe(before.draft.rules[0]);
    expect(after.draft.rules[1]).toBe(before.draft.rules[1]); // structural sharing
    expect(after.draft.inputFields).toBe(before.draft.inputFields);
  });

  it('returns the same state for a change that changes nothing', () => {
    const state = initEditor(example());
    expect(
      editorReducer(state, { type: 'addGroup', rule: 0, group: [0, 0] }),
    ).toBe(state);
  });

  describe('conditions', () => {
    // Rule 0: "hasDefaulted EQ true" (BOOLEAN)
    it('reshapes the value when the operator changes', () => {
      // Rule 1, first condition: creditScore LT 600 (NUMBER)
      let state = run([
        {
          type: 'setConditionOperator',
          rule: 1,
          path: [0],
          operator: 'BETWEEN',
        },
      ]);
      expect(conditionAt(state.draft.rules[1].when, [0])).toMatchObject({
        operator: 'BETWEEN',
        value: [600, 600],
      });
      state = run(
        [{ type: 'setConditionOperator', rule: 1, path: [0], operator: 'IN' }],
        state,
      );
      expect(conditionAt(state.draft.rules[1].when, [0])).toMatchObject({
        operator: 'IN',
        value: [600],
      });
      state = run(
        [
          {
            type: 'setConditionOperator',
            rule: 1,
            path: [0],
            operator: 'IS_EMPTY',
          },
        ],
        state,
      );
      expect(conditionAt(state.draft.rules[1].when, [0])).toEqual({
        type: 'condition',
        field: 'creditScore',
        operator: 'IS_EMPTY',
      });
    });

    it('resets an operator the new field type does not allow, and the value with it', () => {
      // creditScore LT 600 → hasDefaulted (BOOLEAN): LT isn't allowed, value 600 isn't a boolean
      const state = run([
        {
          type: 'setConditionField',
          rule: 1,
          path: [0],
          field: 'hasDefaulted',
        },
      ]);
      expect(conditionAt(state.draft.rules[1].when, [0])).toEqual({
        type: 'condition',
        field: 'hasDefaulted',
        operator: 'EQ',
        value: true,
      });
      expect(draftProblems(state.draft).all).toEqual([]);
    });

    it('keeps the value when switching between fields of the same type', () => {
      const fields = example()
        .inputFields.filter((f) => f.type === 'NUMBER')
        .map((f) => f.key);
      const state = run([
        { type: 'setConditionField', rule: 1, path: [0], field: fields[1] },
      ]);
      expect(conditionAt(state.draft.rules[1].when, [0])).toMatchObject({
        field: fields[1],
        operator: 'LT',
        value: 600,
      });
    });

    it('adds conditions and groups, but no deeper than 3 levels', () => {
      let state = run([
        { type: 'addGroup', rule: 0, group: [] }, // level 2, at [1]
        { type: 'addGroup', rule: 0, group: [1] }, // level 3, at [1, 1]
        { type: 'addGroup', rule: 0, group: [1, 1] }, // would be level 4: ignored
        { type: 'addCondition', rule: 0, group: [1, 1] },
      ]);
      const level3 = groupAt(state.draft.rules[0].when, [1, 1]);
      expect(level3.children.map((c) => c.type)).toEqual([
        'condition',
        'condition',
      ]);
      expect(draftProblems(state.draft).structure).toEqual([]);
      state = run(
        [{ type: 'setGroupOperator', rule: 0, group: [1], operator: 'OR' }],
        state,
      );
      expect(groupAt(state.draft.rules[0].when, [1]).operator).toBe('OR');
    });

    it("removes a nested group when its last condition goes, but keeps the top group's last one", () => {
      let state = run([{ type: 'addGroup', rule: 0, group: [] }]);
      state = run([{ type: 'removeNode', rule: 0, path: [1, 0] }], state);
      expect(state.draft.rules[0].when.children).toHaveLength(1);
      state = run([{ type: 'removeNode', rule: 0, path: [0] }], state);
      expect(state.draft.rules[0].when.children).toHaveLength(1);
    });
  });

  describe('fields, rules and actions', () => {
    it('adds a field with an unused key, and drops allowed values when it stops being text', () => {
      let state = run([{ type: 'addField' }]);
      const index = state.draft.inputFields.length - 1;
      expect(state.draft.inputFields[index]).toMatchObject({ type: 'STRING' });
      expect(new Set(state.draft.inputFields.map((f) => f.key)).size).toBe(
        state.draft.inputFields.length,
      );
      state = run(
        [
          { type: 'setAllowedValues', index, values: ['A', 'B'] },
          { type: 'setFieldType', index, fieldType: 'NUMBER' },
        ],
        state,
      );
      expect(state.draft.inputFields[index]).not.toHaveProperty(
        'allowedValues',
      );
    });

    it('adds a valid rule with the next priority', () => {
      const state = run([{ type: 'addRule' }]);
      const rule = state.draft.rules.at(-1);
      expect(rule?.priority).toBe(
        Math.max(...example().rules.map((r) => r.priority)) + 1,
      );
      expect(draftProblems(state.draft).all).toEqual([]);
    });

    it('removes an optional text when it is cleared, instead of saving an empty string', () => {
      const state = run([
        { type: 'setDefaultAction', patch: { reason: '' } },
        { type: 'updateRule', rule: 0, patch: { description: '' } },
      ]);
      expect(state.draft.defaultAction).not.toHaveProperty('reason');
      expect(state.draft.rules[0]).not.toHaveProperty('description');
    });

    it('lets a removed field show up as problems on the rules that used it', () => {
      const index = example().inputFields.findIndex(
        (f) => f.key === 'hasDefaulted',
      );
      const state = run([{ type: 'removeField', index }]);
      expect(draftProblems(state.draft).crossField).toContainEqual({
        path: '/rules/0/when/children/0/field',
        message: 'There is no input field "hasDefaulted".',
      });
    });
  });
});

describe('draftProblems', () => {
  it('points at the value, not the whole condition, when a value is missing', () => {
    const state = run([
      {
        type: 'setConditionValue',
        rule: 1,
        path: [0],
        value: null as unknown as number,
      },
    ]);
    expect(draftProblems(state.draft).structure).toEqual([
      { path: '/rules/1/when/children/0/value', message: 'Enter a value.' },
    ]);
  });

  it('points at the right half of a BETWEEN', () => {
    const state = run([
      { type: 'setConditionOperator', rule: 1, path: [0], operator: 'BETWEEN' },
      {
        type: 'setConditionValue',
        rule: 1,
        path: [0],
        value: [1, null as unknown as number],
      },
    ]);
    expect(draftProblems(state.draft).structure).toEqual([
      { path: '/rules/1/when/children/0/value/1', message: 'Enter a value.' },
    ]);
  });

  it('points into a nested group', () => {
    const state = run([
      {
        type: 'setConditionValue',
        rule: 1,
        path: [1, 0],
        value: null as unknown as number,
      },
    ]);
    expect(draftProblems(state.draft).structure).toEqual([
      {
        path: '/rules/1/when/children/1/children/0/value',
        message: 'Enter a value.',
      },
    ]);
  });

  it('reports structure problems in plain words, with a path', () => {
    const state = run([
      {
        type: 'setConditionOperator',
        rule: 1,
        path: [0],
        operator: 'CONTAINS',
      },
    ]);
    // CONTAINS isn't allowed on a number, but first: its text value is missing
    const withText = run(
      [{ type: 'setConditionValue', rule: 1, path: [0], value: '' }],
      state,
    );
    expect(draftProblems(withText.draft).structure).toContainEqual({
      path: '/rules/1/when/children/0/value',
      message: 'Enter a value.',
    });
  });
});

describe('describeGroup', () => {
  it('summarises a rule in one line, with nested groups in brackets', () => {
    const rules = example().rules;
    expect(describeGroup(rules[1].when, example().inputFields)).toMatch(
      /^Credit score is less than 600 AND \(.+ OR .+\)$/,
    );
  });
});
