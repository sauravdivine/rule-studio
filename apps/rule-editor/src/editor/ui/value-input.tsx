import { useEffect, useState } from 'react';
import type {
  Condition,
  InputField,
  ValidationProblem,
} from '@rule-studio/shared-types';
import { Input, Select } from '@rule-studio/ui';
import { valueShape, type Value } from '../model';
import { problemsAt } from '../problems';
import { controlProps, FieldProblem } from './field-problem';

// The value part of a condition, matching the field's type and the operator's
// shape: one input, two (BETWEEN), a list (IN), or nothing (IS_EMPTY).

type Props = {
  condition: Condition;
  field: InputField | undefined;
  path: string; // JSON Pointer of the condition
  label: string; // e.g. "condition 2"
  problems: ValidationProblem[];
  onChange: (value: Value | Value[]) => void;
};

export function ValueInput({
  condition,
  field,
  path,
  label,
  problems,
  onChange,
}: Props) {
  if (!field || !('value' in condition)) return null;
  const shape = valueShape(condition.operator);
  const value = condition.value as unknown;

  if (shape === 'pair' && Array.isArray(value)) {
    return (
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <ScalarInput
            field={field}
            value={value[0]}
            label={`From value, ${label}`}
            {...controlProps(problems, `${path}/value/0`)}
            onChange={(v) => onChange([v, value[1] as Value])}
          />
          <span className="text-sm text-muted-foreground">and</span>
          <ScalarInput
            field={field}
            value={value[1]}
            label={`To value, ${label}`}
            {...controlProps(problems, `${path}/value/1`)}
            onChange={(v) => onChange([value[0] as Value, v])}
          />
        </div>
        <ValueProblems problems={problems} path={path} />
      </div>
    );
  }
  if (shape === 'list' && Array.isArray(value)) {
    return (
      <div className="grid gap-1">
        <ListInput
          field={field}
          values={value as Value[]}
          label={`Values, ${label}`}
          {...controlProps(problems, `${path}/value`)}
          onChange={onChange}
        />
        <ValueProblems problems={problems} path={path} />
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <ScalarInput
        field={field}
        value={value}
        label={`Value, ${label}`}
        {...controlProps(problems, `${path}/value`)}
        onChange={onChange}
      />
      <ValueProblems problems={problems} path={path} />
    </div>
  );
}

// Every problem inside the value (each item of a list or pair), under the inputs.
function ValueProblems({
  problems,
  path,
}: {
  problems: ValidationProblem[];
  path: string;
}) {
  const found = problemsAt(problems, `${path}/value`);
  if (found.length === 0) return null;
  return <FieldProblem problems={found} path={found[0].path} />;
}

type ScalarProps = {
  field: InputField;
  value: unknown;
  label: string;
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  onChange: (value: Value) => void;
};

function ScalarInput({ field, value, label, onChange, ...aria }: ScalarProps) {
  switch (field.type) {
    case 'NUMBER':
      return (
        <Input
          type="number"
          className="w-32"
          aria-label={label}
          value={typeof value === 'number' ? value : ''}
          // An empty box isn't a number: kept as null so the problem shows ("Enter a value").
          onChange={(e) =>
            onChange(
              (e.target.value === '' ? null : Number(e.target.value)) as Value,
            )
          }
          {...aria}
        />
      );
    case 'DATE':
      return (
        <Input
          type="date"
          className="w-44"
          aria-label={label}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      );
    case 'BOOLEAN':
      return (
        <Select
          className="w-28"
          aria-label={label}
          value={String(value)}
          onValueChange={(v) => onChange(v === 'true')}
          options={[
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
          {...aria}
        />
      );
    case 'STRING':
      return field.allowedValues ? (
        <Select
          className="w-44"
          aria-label={label}
          value={typeof value === 'string' ? value : undefined}
          onValueChange={onChange}
          options={field.allowedValues.map((v) => ({ value: v, label: v }))}
          {...aria}
        />
      ) : (
        <Input
          className="w-44"
          aria-label={label}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          {...aria}
        />
      );
  }
}

// A comma-separated list. Typed text is kept as typed (so "600, " doesn't lose
// its comma mid-typing) and parsed into values on every change.
function ListInput({
  field,
  values,
  label,
  onChange,
  ...aria
}: {
  field: InputField;
  values: Value[];
  label: string;
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  onChange: (values: Value[]) => void;
}) {
  const joined = values.map(String).join(', ');
  const [text, setText] = useState(joined);
  // Follow changes made elsewhere (another field picked, a restore) unless the
  // text already means the same values.
  useEffect(() => {
    setText((current) =>
      parseList(current, field).map(String).join(', ') === joined
        ? current
        : joined,
    );
  }, [joined, field]);

  return (
    <Input
      className="w-64"
      aria-label={label}
      placeholder={
        field.allowedValues
          ? field.allowedValues.join(', ')
          : 'Comma-separated, e.g. 1, 2, 3'
      }
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseList(e.target.value, field));
      }}
      {...aria}
    />
  );
}

function parseList(text: string, field: InputField): Value[] {
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return field.type === 'NUMBER'
    ? parts.map((p) => (Number.isNaN(Number(p)) ? p : Number(p)))
    : parts;
}
