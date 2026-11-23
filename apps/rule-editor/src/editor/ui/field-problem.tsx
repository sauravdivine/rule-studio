import type { ValidationProblem } from '@rule-studio/shared-types';
import { problemsExactlyAt } from '../problems';
import { controlId } from './editor-context';

// The problems for one control, shown under it. Their element id goes into
// the control's aria-describedby, so a screen reader reads the problem with it.
export const problemId = (pointer: string) => controlId(pointer) + '-problem';

export function FieldProblem({
  problems,
  path,
}: {
  problems: ValidationProblem[];
  path: string;
}) {
  const here = problemsExactlyAt(problems, path);
  if (here.length === 0) return null;
  return (
    <p id={problemId(path)} className="text-xs font-medium text-destructive">
      {here.map((p) => p.message).join(' ')}
    </p>
  );
}

// Props for a control at `path`: its id, and the problem wiring when it has one.
export function controlProps(problems: ValidationProblem[], path: string) {
  const invalid = problemsExactlyAt(problems, path).length > 0;
  return {
    id: controlId(path),
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? problemId(path) : undefined,
  };
}
