// Structural equality for JSON data, ignoring key order: {a,b} equals {b,a}.
// Used for "unsaved changes"; the server makes the same judgement with a
// canonical-JSON hash (spec 003).
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const ka = Object.keys(a).filter(
    (k) => (a as Record<string, unknown>)[k] !== undefined,
  );
  const kb = Object.keys(b).filter(
    (k) => (b as Record<string, unknown>)[k] !== undefined,
  );
  return (
    ka.length === kb.length &&
    ka.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    )
  );
}
