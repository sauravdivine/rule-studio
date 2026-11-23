import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react';
import { isAbort } from './errors';

// Hand-written data loading (spec 005, decision 2: TanStack Query comes later,
// to compare). Everything this hook does is something a data library would
// do for us. Each part is commented with the problem it solves.
//
// Usage: const rulesets = useResource((signal) => api.list(query, signal), [query]);

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  // True while a request runs, including a reload with old data still shown.
  loading: boolean;
  reload: () => void;
  // Replace the data with what a mutation returned, so the screen updates
  // without another request (a save returns the saved ruleset).
  setData: (data: T) => void;
}

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): Resource<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  // The latest loader, without making it a dependency (callers pass a new
  // arrow function every render).
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    // Race conditions: if the inputs change while a request is in flight (the
    // user types a second letter into search), the old response may arrive
    // last and overwrite the new one. Aborting the old request on every change
    // (and ignoring its result) makes the latest request always win.
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    loadRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e: unknown) => {
        // A cancelled request isn't an error the user needs to see.
        if (!controller.signal.aborted && !isAbort(e)) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    // Cleanup also runs on unmount: no "state update on an unmounted component".
    return () => controller.abort();
    // The caller's deps decide when to reload (the loader itself changes every render).
  }, [...deps, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}
