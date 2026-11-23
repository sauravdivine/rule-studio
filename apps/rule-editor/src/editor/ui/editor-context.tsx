import { createContext, useContext, type Dispatch } from 'react';
import type { InputField, ValidationProblem } from '@rule-studio/shared-types';
import type { EditorAction } from '../reducer';

// What every control in the draft editor needs, without passing it down
// through each level of nested groups. A plain React context is fine here:
// it never leaves this remote's bundle.
export interface EditorContextValue {
  dispatch: Dispatch<EditorAction>;
  fields: InputField[];
  problems: ValidationProblem[];
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value)
    throw new Error('useEditor() must be used inside the draft editor');
  return value;
}

// A DOM id for the control that edits the value at a JSON Pointer, so a problem
// in the panel can move focus to it: "/rules/0/name" → "edit-rules-0-name".
export const controlId = (pointer: string) =>
  'edit' + pointer.replace(/[^a-zA-Z0-9]/g, '-');

// Focuses the control for a problem's path, or the nearest control above it
// (a problem about a whole group focuses the group's first control).
export function focusProblem(pointer: string): boolean {
  for (let path = pointer; path; path = path.slice(0, path.lastIndexOf('/'))) {
    const element = document.getElementById(controlId(path));
    if (element) {
      element.focus();
      element.scrollIntoView?.({ block: 'center' });
      return true;
    }
  }
  return false;
}
