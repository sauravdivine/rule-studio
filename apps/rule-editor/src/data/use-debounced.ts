import { useEffect, useState } from 'react';

// The value, but only after it stops changing for `delay` ms. Typing "loan"
// into search sends one request, not four.
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
