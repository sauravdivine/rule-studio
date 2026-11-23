import type { InputField, ValidationProblem } from '@rule-studio/shared-types';
import { isIsoDate } from '@rule-studio/ruleset-validation';
import { isMissing, type Input } from './engine.js';

// Text in quotes, everything else as itself (so NaN reads as NaN, not null).
const shown = (value: unknown) =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

const NEEDS = {
  NUMBER: 'a number',
  STRING: 'text',
  BOOLEAN: 'true or false',
  DATE: 'a date (YYYY-MM-DD)',
} as const;

// Checks an input record before evaluation (spec 006, decision 3: strict). A
// value of the wrong type is a problem, not "missing": a typo in a caller's
// payload must not quietly change the decision. Missing values are fine (the
// engine handles them), and keys that aren't input fields are ignored.
export function checkInput(
  fields: InputField[],
  input: Input,
): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  for (const field of fields) {
    const value = Object.hasOwn(input, field.key)
      ? input[field.key]
      : undefined;
    if (isMissing(value, field.type)) continue;
    const path = '/' + field.key;
    const ok =
      field.type === 'NUMBER'
        ? typeof value === 'number' && Number.isFinite(value)
        : field.type === 'STRING'
          ? typeof value === 'string'
          : field.type === 'BOOLEAN'
            ? typeof value === 'boolean'
            : isIsoDate(value);
    if (!ok) {
      problems.push({
        path,
        message: `"${field.label}" needs ${NEEDS[field.type]}, not ${shown(value)}.`,
      });
    } else if (
      field.allowedValues &&
      !field.allowedValues.includes(value as string)
    ) {
      problems.push({
        path,
        message: `"${String(value)}" isn't an allowed value for "${field.label}" (${field.allowedValues.join(', ')}).`,
      });
    }
  }
  return problems;
}
