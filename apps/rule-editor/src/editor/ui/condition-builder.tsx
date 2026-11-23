import { Plus, Trash2 } from 'lucide-react';
import type { Condition, ConditionGroup } from '@rule-studio/shared-types';
import { operatorsFor } from '@rule-studio/ruleset-validation';
import { Button, Select } from '@rule-studio/ui';
import { OPERATOR_LABEL } from '../describe';
import { canAddGroupInside, type Group, type NodePath } from '../model';
import { controlProps, FieldProblem } from './field-problem';
import { useEditor } from './editor-context';
import { ValueInput } from './value-input';

// The condition builder (spec 005): AND/OR groups up to 3 levels, conditions
// with a field, an operator allowed for its type, and a value input that
// matches. It is recursive: a group renders its children, and a child that is
// a group renders another GroupEditor.
//
// Keyboard: everything is a real button, select or input in reading order, so
// Tab and Shift+Tab walk through it, and every control has a label that says
// where it is ("Operator, condition 2 in group 1.1").

// `ruleLabel` ends every control's label ("…, rule #2"), so labels stay unique
// when several rules are open at once.
export function ConditionBuilder({
  rule,
  when,
  ruleLabel,
}: {
  rule: number;
  when: ConditionGroup;
  ruleLabel: string;
}) {
  return (
    <GroupEditor
      rule={rule}
      group={when as Group}
      path={[]}
      name="1"
      ruleLabel={ruleLabel}
    />
  );
}

type GroupProps = {
  rule: number;
  group: Group;
  path: NodePath;
  name: string;
  ruleLabel: string;
};

function GroupEditor({ rule, group, path, name, ruleLabel }: GroupProps) {
  const { dispatch, problems } = useEditor();
  const pointer = `/rules/${rule}/when${path.map((i) => `/children/${i}`).join('')}`;
  const isTop = path.length === 0;
  return (
    <div
      role="group"
      aria-label={`Group ${name}, ${ruleLabel}`}
      className="grid gap-2 rounded-md border border-dashed p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-36"
          aria-label={`Match, group ${name}, ${ruleLabel}`}
          value={group.operator}
          onValueChange={(operator) =>
            dispatch({
              type: 'setGroupOperator',
              rule,
              group: path,
              operator: operator as Group['operator'],
            })
          }
          options={[
            { value: 'AND', label: 'All of (AND)' },
            { value: 'OR', label: 'Any of (OR)' },
          ]}
          {...controlProps([], `${pointer}/operator`)}
        />
        <span className="text-sm text-muted-foreground">these are true</span>
        {!isTop && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => dispatch({ type: 'removeNode', rule, path })}
          >
            <Trash2 aria-hidden="true" /> Remove group {name}
            <span className="sr-only">, {ruleLabel}</span>
          </Button>
        )}
      </div>
      <ol className="grid gap-2">
        {group.children.map((child, i) => (
          <li key={i}>
            {child.type === 'group' ? (
              <GroupEditor
                rule={rule}
                group={child}
                path={[...path, i]}
                name={`${name}.${i + 1}`}
                ruleLabel={ruleLabel}
              />
            ) : (
              <ConditionRow
                rule={rule}
                condition={child}
                path={[...path, i]}
                label={`condition ${i + 1} in group ${name}, ${ruleLabel}`}
                // The top group must keep at least one condition (the contract needs one).
                removable={!(isTop && group.children.length === 1)}
              />
            )}
          </li>
        ))}
      </ol>
      <FieldProblem problems={problems} path={`${pointer}/children`} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: 'addCondition', rule, group: path })}
        >
          <Plus aria-hidden="true" /> Add condition to group {name}
          <span className="sr-only">, {ruleLabel}</span>
        </Button>
        {canAddGroupInside(path) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: 'addGroup', rule, group: path })}
          >
            <Plus aria-hidden="true" /> Add group to group {name}
            <span className="sr-only">, {ruleLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

type RowProps = {
  rule: number;
  condition: Condition;
  path: NodePath;
  label: string;
  removable: boolean;
};

function ConditionRow({ rule, condition, path, label, removable }: RowProps) {
  const { dispatch, fields, problems } = useEditor();
  const pointer = `/rules/${rule}/when${path.map((i) => `/children/${i}`).join('')}`;
  const field = fields.find((f) => f.key === condition.field);
  // An unknown field (it was removed) stays visible, so the problem can point at it.
  const fieldOptions = [
    ...fields.map((f) => ({ value: f.key, label: f.label })),
    ...(field
      ? []
      : [{ value: condition.field, label: `${condition.field} (missing)` }]),
  ];
  const operators = field ? operatorsFor(field.type) : [condition.operator];

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-start gap-2">
        <div className="grid gap-1">
          <Select
            className="w-48"
            aria-label={`Field, ${label}`}
            value={condition.field}
            onValueChange={(key) =>
              dispatch({ type: 'setConditionField', rule, path, field: key })
            }
            options={fieldOptions}
            {...controlProps(problems, `${pointer}/field`)}
          />
          <FieldProblem problems={problems} path={`${pointer}/field`} />
        </div>
        <div className="grid gap-1">
          <Select
            className="w-44"
            aria-label={`Operator, ${label}`}
            value={condition.operator}
            onValueChange={(operator) =>
              dispatch({
                type: 'setConditionOperator',
                rule,
                path,
                operator: operator as Condition['operator'],
              })
            }
            options={operators.map((op) => ({
              value: op,
              label: OPERATOR_LABEL[op],
            }))}
            {...controlProps(problems, `${pointer}/operator`)}
          />
          <FieldProblem problems={problems} path={`${pointer}/operator`} />
        </div>
        <ValueInput
          condition={condition}
          field={field}
          path={pointer}
          label={label}
          problems={problems}
          onChange={(value) =>
            dispatch({ type: 'setConditionValue', rule, path, value })
          }
        />
        {removable && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${label}`}
            onClick={() => dispatch({ type: 'removeNode', rule, path })}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
