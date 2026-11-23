import {
  zRulesetContent,
  type RulesetContent,
  type ValidationProblem,
} from '@rule-studio/shared-types';
import { validateRulesetContent } from '@rule-studio/ruleset-validation';

// Everything wrong with a draft, as the API would judge it (spec 005, decision 5).
//
// Two kinds, matching the API's two levels (spec 003):
//   - structure: the contract's schema. The API refuses to save these (400),
//     so the editor blocks Save until they're fixed.
//   - cross-field: libs/ruleset-validation. Saving is fine; publishing isn't.
// Every problem has a JSON Pointer path, used to show it next to its control.

export interface DraftProblems {
  structure: ValidationProblem[];
  crossField: ValidationProblem[];
  all: ValidationProblem[];
}

export function draftProblems(draft: RulesetContent): DraftProblems {
  const parsed = zRulesetContent.safeParse(draft);
  const structure = parsed.success
    ? []
    : dedupe(
        flatten(parsed.error.issues as unknown as Issue[], []).map((issue) => ({
          path: pointer(issue.path),
          message: friendly(issue.path, issue.message),
        })),
      );
  // Cross-field checks assume the structure is right, so run them only then.
  const crossField = parsed.success ? validateRulesetContent(draft) : [];
  return { structure, crossField, all: [...structure, ...crossField] };
}

// Zod reports a union ("a condition is one of five shapes") by listing, for
// each shape, why the data isn't it. The useful one is the shape whose
// discriminators (type, operator) match: that's the one the user meant. Its
// own issues, with full paths, are what to show. If no single shape matches
// (a value that should be string, number or boolean), the union's own spot
// is the problem.
interface Issue {
  code: string;
  path: PropertyKey[];
  message: string;
  errors?: Issue[][];
}

const DISCRIMINATORS = new Set(['type', 'operator']);

// A shape the data clearly isn't: it fails on a discriminator, directly or in a
// nested union where every option does (a group is no kind of condition).
function mismatches(branch: Issue[]): boolean {
  return branch.some(
    (issue) =>
      (issue.path.length === 1 && DISCRIMINATORS.has(String(issue.path[0]))) ||
      (issue.code === 'invalid_union' &&
        issue.path.length === 0 &&
        (issue.errors ?? []).every(mismatches)),
  );
}

function flatten(
  issues: Issue[],
  base: PropertyKey[],
): Array<{ path: PropertyKey[]; message: string }> {
  return issues.flatMap((issue) => {
    const path = [...base, ...issue.path];
    if (issue.code !== 'invalid_union' || !issue.errors)
      return [{ path, message: issue.message }];
    const matching = issue.errors.filter((branch) => !mismatches(branch));
    return matching.length === 1
      ? flatten(matching[0], path)
      : [{ path, message: issue.message }];
  });
}

const pointer = (path: PropertyKey[]) =>
  '/' +
  path.map((p) => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');

// The schema's messages are written for developers ("Too small: expected
// string to have >=1 characters"). Say it the way a user would.
function friendly(path: PropertyKey[], fallback: string): string {
  const last = String(path[path.length - 1]);
  const inValue = path.includes('value');
  if (inValue) return 'Enter a value.';
  if (last === 'name') return 'Give the rule a name.';
  if (last === 'label') return 'Give the field a label.';
  if (last === 'key')
    return 'Use letters, numbers and _, starting with a letter (at most 50).';
  if (last === 'allowedValues' || path.includes('allowedValues'))
    return 'Allowed values must be unique and not empty.';
  if (last === 'priority')
    return 'Priority must be a whole number of 1 or more.';
  if (last === 'reason') return 'Keep the reason to 200 characters.';
  if (last === 'children') return 'A group needs at least one condition.';
  return fallback;
}

// A union in the schema can report the same spot several times.
function dedupe(problems: ValidationProblem[]): ValidationProblem[] {
  const seen = new Set<string>();
  return problems.filter((p) => {
    const key = p.path + p.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Problems at a path or anywhere inside it, for showing next to a control.
export const problemsAt = (problems: ValidationProblem[], path: string) =>
  problems.filter((p) => p.path === path || p.path.startsWith(path + '/'));

// Problems exactly at a path.
export const problemsExactlyAt = (
  problems: ValidationProblem[],
  path: string,
) => problems.filter((p) => p.path === path);
