import { createTestHost } from './testing.js';

describe('createTestHost', () => {
  it('uses the real permission rules for the role', () => {
    const viewer = createTestHost('VIEWER');
    expect(viewer.can('ruleset:read')).toBe(true);
    expect(viewer.can('ruleset:edit')).toBe(false);
    expect(createTestHost('EDITOR').can('ruleset:publish')).toBe(true);
  });

  it('fails loudly when a test forgot to give it an API', async () => {
    await expect(
      createTestHost('ADMIN').api.get('/api/rulesets'),
    ).rejects.toThrow(/no API/);
  });

  it('uses the API a test supplies', async () => {
    const host = createTestHost('VIEWER', {
      api: { get: async <T>() => ['ok'] as T },
    });
    await expect(host.api.get('/api/rulesets')).resolves.toEqual(['ok']);
  });
});
