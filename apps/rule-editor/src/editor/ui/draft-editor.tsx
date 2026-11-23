import { useMemo, useState, type Dispatch } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type {
  Decision,
  InputField,
  Rule,
  RulesetContent,
  ValidationProblem,
} from '@rule-studio/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@rule-studio/ui';
import { describeGroup } from '../describe';
import type { EditorAction } from '../reducer';
import { problemsAt } from '../problems';
import { ConditionBuilder } from './condition-builder';
import { EditorContext, focusProblem, useEditor } from './editor-context';
import { controlProps, FieldProblem } from './field-problem';

// The Draft tab (spec 005): input fields, hit strategy, default action, rules,
// and the problems panel. Every change is dispatched to the editor reducer.

const DECISIONS: Array<{ value: Decision; label: string }> = [
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'REFER', label: 'Refer' },
];
const FIELD_TYPES = [
  { value: 'STRING', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'BOOLEAN', label: 'True / false' },
  { value: 'DATE', label: 'Date' },
];
export const DECISION_BADGE = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REFER: 'refer',
} as const;

export function DraftEditor({
  draft,
  problems,
  dispatch,
}: {
  draft: RulesetContent;
  problems: ValidationProblem[];
  dispatch: Dispatch<EditorAction>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const context = useMemo(
    () => ({ dispatch, fields: draft.inputFields, problems }),
    [dispatch, draft.inputFields, problems],
  );

  // Jump to a problem: open its rule first if it's inside one, then focus it
  // once the rule's controls exist.
  function showProblem(path: string) {
    const rule = /^\/rules\/(\d+)/.exec(path);
    if (rule) setExpanded((current) => new Set(current).add(Number(rule[1])));
    requestAnimationFrame(() => focusProblem(path));
  }

  return (
    <EditorContext.Provider value={context}>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* grid-cols-1 is minmax(0, 1fr): without it the column grows to fit the
            fields table instead of letting the table scroll sideways. */}
        <div className="grid min-w-0 grid-cols-1 gap-6">
          <InputFieldsSection fields={draft.inputFields} rules={draft.rules} />
          <StrategySection draft={draft} />
          <RulesSection
            rules={draft.rules}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        </div>
        <ProblemsPanel problems={problems} onSelect={showProblem} />
      </div>
    </EditorContext.Provider>
  );
}

// --- Problems panel ---

function ProblemsPanel({
  problems,
  onSelect,
}: {
  problems: ValidationProblem[];
  onSelect: (path: string) => void;
}) {
  return (
    <aside
      aria-labelledby="problems-heading"
      className="lg:sticky lg:top-20 lg:self-start"
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle as="h2">
            <span id="problems-heading">Problems</span>
          </CardTitle>
          <CardDescription aria-live="polite">
            {problems.length === 0
              ? 'None. Ready to publish.'
              : `${problems.length} to fix before publishing.`}
          </CardDescription>
        </CardHeader>
        {problems.length > 0 && (
          <CardContent>
            <ul className="grid gap-1">
              {problems.map((problem) => (
                <li key={problem.path + problem.message}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    // One label, not two text pieces, so the name always reads
                    // "Enter a value. Rule 2, condition 1".
                    aria-label={`${problem.message} ${describePath(problem.path)}`}
                    onClick={() => onSelect(problem.path)}
                  >
                    {problem.message}
                    <span className="block text-xs text-muted-foreground">
                      {describePath(problem.path)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </aside>
  );
}

// "/rules/2/when/children/0/value" → "Rule 3, condition 1"
function describePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'inputFields') return `Input field ${Number(parts[1]) + 1}`;
  if (parts[0] === 'rules') {
    const conditions = parts
      .filter((p, i) => parts[i - 1] === 'children')
      .map((p) => Number(p) + 1);
    return `Rule ${Number(parts[1]) + 1}${conditions.length ? `, condition ${conditions.join('.')}` : ''}`;
  }
  if (parts[0] === 'defaultAction') return 'Default action';
  return 'Ruleset';
}

// --- Input fields ---

function InputFieldsSection({
  fields,
  rules,
}: {
  fields: InputField[];
  rules: Rule[];
}) {
  const { dispatch, problems } = useEditor();
  const [removing, setRemoving] = useState<number | null>(null);
  const usedBy = (key: string) =>
    rules.filter((r) => JSON.stringify(r.when).includes(`"field":"${key}"`))
      .length;

  return (
    <section
      aria-labelledby="fields-heading"
      className="grid grid-cols-1 gap-3"
    >
      <div className="flex items-center justify-between">
        <h2 id="fields-heading" className="font-semibold">
          Input fields
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: 'addField' })}
        >
          <Plus aria-hidden="true" /> Add field
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Allowed values (text only)</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, i) => {
            const at = (k: string) => `/inputFields/${i}/${k}`;
            return (
              <TableRow key={i}>
                <TableCell className="align-top">
                  <Input
                    aria-label={`Key, field ${i + 1}`}
                    value={field.key}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateField',
                        index: i,
                        patch: { key: e.target.value },
                      })
                    }
                    {...controlProps(problems, at('key'))}
                  />
                  <FieldProblem problems={problems} path={at('key')} />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    aria-label={`Label, field ${i + 1}`}
                    value={field.label}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateField',
                        index: i,
                        patch: { label: e.target.value },
                      })
                    }
                    {...controlProps(problems, at('label'))}
                  />
                  <FieldProblem problems={problems} path={at('label')} />
                </TableCell>
                <TableCell className="align-top">
                  <Select
                    className="min-w-32"
                    aria-label={`Type, field ${i + 1}`}
                    value={field.type}
                    onValueChange={(t) =>
                      dispatch({
                        type: 'setFieldType',
                        index: i,
                        fieldType: t as InputField['type'],
                      })
                    }
                    options={FIELD_TYPES}
                    {...controlProps(problems, at('type'))}
                  />
                </TableCell>
                <TableCell className="align-top">
                  {field.type === 'STRING' ? (
                    <>
                      <AllowedValuesInput field={field} index={i} />
                      <FieldProblem
                        problems={problems}
                        path={at('allowedValues')}
                      />
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove field ${field.label || i + 1}`}
                    disabled={fields.length === 1}
                    onClick={() =>
                      usedBy(field.key) > 0
                        ? setRemoving(i)
                        : dispatch({ type: 'removeField', index: i })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove a field that rules use?"
        description={
          removing !== null
            ? `${usedBy(fields[removing].key)} rule(s) use "${fields[removing].label}". Their conditions will show a problem until you change them.`
            : ''
        }
        confirmLabel="Remove field"
        destructive
        onConfirm={() =>
          removing !== null &&
          dispatch({ type: 'removeField', index: removing })
        }
      />
    </section>
  );
}

function AllowedValuesInput({
  field,
  index,
}: {
  field: InputField;
  index: number;
}) {
  const { dispatch, problems } = useEditor();
  const [text, setText] = useState((field.allowedValues ?? []).join(', '));
  return (
    <Input
      aria-label={`Allowed values, field ${index + 1}`}
      placeholder="Any text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const values = e.target.value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        dispatch({
          type: 'setAllowedValues',
          index,
          values: values.length ? values : undefined,
        });
      }}
      {...controlProps(problems, `/inputFields/${index}/allowedValues`)}
    />
  );
}

// --- Hit strategy and default action ---

function StrategySection({ draft }: { draft: RulesetContent }) {
  const { dispatch, problems } = useEditor();
  return (
    <section
      aria-labelledby="strategy-heading"
      className="grid grid-cols-1 gap-3"
    >
      <h2 id="strategy-heading" className="font-semibold">
        How rules decide
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="edit-hitStrategy">Hit strategy</Label>
          <Select
            id="edit-hitStrategy"
            aria-describedby="hit-strategy-hint"
            value={draft.hitStrategy}
            onValueChange={(v) =>
              dispatch({
                type: 'setHitStrategy',
                hitStrategy: v as RulesetContent['hitStrategy'],
              })
            }
            options={[
              { value: 'FIRST', label: 'First match' },
              { value: 'PRIORITY', label: 'Strictest decision' },
            ]}
          />
          <p id="hit-strategy-hint" className="text-xs text-muted-foreground">
            {draft.hitStrategy === 'FIRST'
              ? 'Rules run in priority order; the first one that matches decides.'
              : 'Every rule runs; the strictest decision wins (Reject, then Refer, then Approve).'}
          </p>
        </div>
        <div className="grid gap-1.5">
          <span
            className="text-sm font-medium leading-none"
            id="default-heading"
          >
            When no rule matches
          </span>
          <div
            className="flex gap-2"
            role="group"
            aria-labelledby="default-heading"
          >
            <Select
              className="w-32"
              aria-label="Default decision"
              value={draft.defaultAction.decision}
              onValueChange={(v) =>
                dispatch({
                  type: 'setDefaultAction',
                  patch: { decision: v as Decision },
                })
              }
              options={DECISIONS}
            />
            <Input
              aria-label="Default reason"
              placeholder="Reason (optional)"
              value={draft.defaultAction.reason ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'setDefaultAction',
                  patch: { reason: e.target.value },
                })
              }
              {...controlProps(problems, '/defaultAction/reason')}
            />
          </div>
          <FieldProblem problems={problems} path="/defaultAction/reason" />
        </div>
      </div>
    </section>
  );
}

// --- Rules ---

function RulesSection({
  rules,
  expanded,
  setExpanded,
}: {
  rules: Rule[];
  expanded: Set<number>;
  setExpanded: (update: (current: Set<number>) => Set<number>) => void;
}) {
  const { dispatch } = useEditor();
  const toggle = (i: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  // Shown in priority order; the index in the draft stays the rule's address.
  const order = rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => a.rule.priority - b.rule.priority);

  return (
    <section aria-labelledby="rules-heading" className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between">
        <h2 id="rules-heading" className="font-semibold">
          Rules
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            dispatch({ type: 'addRule' });
            setExpanded((current) => new Set(current).add(rules.length));
          }}
        >
          <Plus aria-hidden="true" /> Add rule
        </Button>
      </div>
      {rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          description="Without rules, every application gets the default action."
        />
      ) : (
        <ol className="grid grid-cols-1 gap-2">
          {order.map(({ rule, index }) => (
            <li key={rule.id}>
              <RuleCard
                rule={rule}
                index={index}
                expanded={expanded.has(index)}
                onToggle={() => toggle(index)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RuleCard({
  rule,
  index,
  expanded,
  onToggle,
}: {
  rule: Rule;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { dispatch, fields, problems } = useEditor();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const at = (k: string) => `/rules/${index}/${k}`;
  const ruleProblems = problemsAt(problems, `/rules/${index}`);
  const bodyId = `rule-body-${rule.id}`;

  return (
    <Card className={rule.enabled ? undefined : 'opacity-70'}>
      <div className="flex items-center gap-3 p-4">
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} rule ${rule.name}`}
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown aria-hidden="true" />
          ) : (
            <ChevronRight aria-hidden="true" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              #{rule.priority}
            </span>
            <h3 className="font-medium">{rule.name || 'Unnamed rule'}</h3>
            <Badge variant={DECISION_BADGE[rule.then.decision]}>
              {rule.then.decision.toLowerCase()}
            </Badge>
            {ruleProblems.length > 0 && (
              <Badge variant="outline">{ruleProblems.length} problem(s)</Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {describeGroup(rule.when, fields)}
          </p>
        </div>
        <Switch
          aria-label={`Rule ${rule.name} enabled`}
          checked={rule.enabled}
          onCheckedChange={(enabled) =>
            dispatch({ type: 'updateRule', rule: index, patch: { enabled } })
          }
        />
      </div>
      {expanded && (
        <CardContent id={bodyId} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="grid gap-1.5">
              <Label htmlFor={controlProps(problems, at('name')).id}>
                Name
              </Label>
              <Input
                value={rule.name}
                onChange={(e) =>
                  dispatch({
                    type: 'updateRule',
                    rule: index,
                    patch: { name: e.target.value },
                  })
                }
                {...controlProps(problems, at('name'))}
              />
              <FieldProblem problems={problems} path={at('name')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={controlProps(problems, at('priority')).id}>
                Priority
              </Label>
              <Input
                type="number"
                min={1}
                value={rule.priority}
                onChange={(e) =>
                  dispatch({
                    type: 'updateRule',
                    rule: index,
                    patch: {
                      priority:
                        e.target.value === ''
                          ? (null as unknown as number)
                          : Number(e.target.value),
                    },
                  })
                }
                {...controlProps(problems, at('priority'))}
              />
              <FieldProblem problems={problems} path={at('priority')} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={controlProps(problems, at('description')).id}>
              Description
            </Label>
            <Textarea
              rows={2}
              value={rule.description ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'updateRule',
                  rule: index,
                  patch: { description: e.target.value },
                })
              }
              {...controlProps(problems, at('description'))}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">When</span>
            <ConditionBuilder
              rule={index}
              when={rule.when}
              ruleLabel={`rule #${rule.priority}`}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id={`then-${rule.id}`}>
              Then
            </span>
            <div
              className="flex gap-2"
              role="group"
              aria-labelledby={`then-${rule.id}`}
            >
              <Select
                className="w-32"
                aria-label={`Decision, rule ${rule.name}`}
                value={rule.then.decision}
                onValueChange={(v) =>
                  dispatch({
                    type: 'setThen',
                    rule: index,
                    patch: { decision: v as Decision },
                  })
                }
                options={DECISIONS}
              />
              <Input
                aria-label={`Reason, rule ${rule.name}`}
                placeholder="Reason (optional)"
                value={rule.then.reason ?? ''}
                onChange={(e) =>
                  dispatch({
                    type: 'setThen',
                    rule: index,
                    patch: { reason: e.target.value },
                  })
                }
                {...controlProps(problems, at('then/reason'))}
              />
            </div>
            <FieldProblem problems={problems} path={at('then/reason')} />
          </div>
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden="true" /> Delete rule
            </Button>
          </div>
        </CardContent>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${rule.name}"?`}
        description="It's removed from the draft. Published versions keep it."
        confirmLabel="Delete rule"
        destructive
        onConfirm={() => dispatch({ type: 'removeRule', rule: index })}
      />
    </Card>
  );
}
