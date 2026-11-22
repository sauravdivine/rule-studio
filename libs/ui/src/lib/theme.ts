import { useCallback, useSyncExternalStore } from 'react';

// Spec 004: the theme lives on <html data-theme="light|dark">, not in React state.
// CSS reads the attribute directly, so the shell and every remote (each with its
// own copy of this library) follow the same theme without sharing a React context.

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Keep in sync with the no-flash script in apps/shell/index.html.
export const THEME_STORAGE_KEY = 'rs-theme';
const CHANGE_EVENT = 'rs-themechange';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    // Storage can be blocked (private mode, strict settings). Follow the system.
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const resolved = resolveTheme(preference);
  root.dataset['theme'] = resolved;
  // Lets the browser draw scrollbars and form controls to match.
  root.style.colorScheme = resolved;
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not saved, but still applied for this page view.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Something changed the theme: this copy of the library, another remote's copy
// (custom event), another tab (storage event) or the OS setting (media query).
function subscribe(onChange: () => void): () => void {
  const onSystemChange = () => {
    if (readThemePreference() === 'system') applyTheme('system');
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(readThemePreference());
    onChange();
  };
  const media =
    typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null;
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  media?.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
    media?.removeEventListener('change', onSystemChange);
  };
}

// The snapshot is a string so React can compare it cheaply between renders.
function getSnapshot(): string {
  const preference = readThemePreference();
  return `${preference}:${resolveTheme(preference)}`;
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 'system:light',
  );
  const [preference, resolved] = snapshot.split(':') as [
    ThemePreference,
    ResolvedTheme,
  ];
  const setPreference = useCallback(setThemePreference, []);
  return { preference, resolved, setPreference };
}
