import { isApiError } from '@rule-studio/api-client';
import type { ValidationProblem } from '@rule-studio/shared-types';

// Reading the API's problem details (spec 003). isApiError, not instanceof:
// the error was thrown by the shell's copy of the API client.

export const statusOf = (error: unknown): number | undefined =>
  isApiError(error) ? error.status : undefined;

export const isConflict = (error: unknown) => statusOf(error) === 412;

// Extra fields on the problem: `problems` (422), `errors` (400), `currentRevision` (412).
function extra<T>(error: unknown, key: string): T | undefined {
  if (!isApiError(error) || !error.problem) return undefined;
  return (error.problem as unknown as Record<string, T>)[key];
}

export const serverProblems = (error: unknown) =>
  extra<ValidationProblem[]>(error, 'problems') ?? [];

// A sentence to show the user, from the problem's detail when there is one.
export function messageOf(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof TypeError)
    return 'Could not reach the server. Check your connection and try again.';
  return 'Something went wrong. Try again.';
}

export const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';
