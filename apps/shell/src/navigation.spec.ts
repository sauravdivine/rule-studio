import { describe, expect, it } from 'vitest';
import { safeReturnPath, visibleSections } from './navigation';

describe('visibleSections', () => {
  it('shows only the sections the user has permission for', () => {
    const paths = visibleSections((p) => p !== 'simulation:run').map(
      (s) => s.path,
    );
    expect(paths).toEqual(['/rulesets', '/dashboard']);
  });
});

describe('safeReturnPath', () => {
  it.each(['/simulator', '/dashboard?tab=2', '/rulesets#top'])(
    'keeps the in-app path %s',
    (path) => {
      expect(safeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/login',
    '/login?returnTo=/x',
    'javascript:alert(1)',
  ])('falls back to /rulesets for %s', (path) => {
    expect(safeReturnPath(path)).toBe('/rulesets');
  });
});
