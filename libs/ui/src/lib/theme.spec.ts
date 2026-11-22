import { act, renderHook } from '@testing-library/react';
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  setThemePreference,
  THEME_STORAGE_KEY,
  useTheme,
} from './theme';

function mockSystemDark(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        ...window.matchMedia,
        matches: dark,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

describe('theme', () => {
  afterEach(() => vi.restoreAllMocks());

  it('defaults to following the system', () => {
    expect(readThemePreference()).toBe('system');
  });

  it('ignores a garbage stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readThemePreference()).toBe('system');
  });

  it('resolves "system" from the OS setting', () => {
    mockSystemDark(true);
    expect(resolveTheme('system')).toBe('dark');
    mockSystemDark(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('writes the resolved theme to <html>', () => {
    mockSystemDark(true);
    applyTheme('system');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('still applies the theme when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setThemePreference('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('updates every useTheme() when any copy of the library changes it', () => {
    const first = renderHook(() => useTheme());
    const second = renderHook(() => useTheme());
    act(() => first.result.current.setPreference('dark'));
    expect(second.result.current).toMatchObject({
      preference: 'dark',
      resolved: 'dark',
    });
  });

  it('follows a change made in another tab', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      window.dispatchEvent(
        new StorageEvent('storage', { key: THEME_STORAGE_KEY }),
      );
    });
    expect(result.current.preference).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
