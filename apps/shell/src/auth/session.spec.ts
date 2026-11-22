import { describe, expect, it } from 'vitest';
import { ApiError } from '@rule-studio/api-client';
import { createFakeApi, PASSWORD } from '../test/fake-api';
import { createAuthSession, loginErrorMessage } from './session';

const count = (calls: string[], call: string) =>
  calls.filter((c) => c === call).length;

describe('auth session', () => {
  it('starts signed out when there is no refresh cookie', async () => {
    const server = createFakeApi();
    const session = createAuthSession({ fetch: server.fetch });
    expect(session.getState().status).toBe('loading');
    await session.start();
    expect(session.getState().status).toBe('signedOut');
    expect(session.getHost()).toBeNull();
  });

  it('restores the session from the refresh cookie on page load', async () => {
    const server = createFakeApi({ signedInAs: 'editor@rulestudio.dev' });
    const session = createAuthSession({ fetch: server.fetch });
    await session.start();
    expect(session.getState()).toMatchObject({
      status: 'signedIn',
      user: { role: 'EDITOR' },
    });
  });

  it('refreshes once even if start() is called twice, as StrictMode does', async () => {
    const server = createFakeApi({ signedInAs: 'viewer@rulestudio.dev' });
    const session = createAuthSession({ fetch: server.fetch });
    await Promise.all([session.start(), session.start()]);
    expect(count(server.calls, 'POST /api/auth/refresh')).toBe(1);
  });

  it('refreshes an expired access token once for parallel requests, then retries them', async () => {
    const server = createFakeApi();
    const session = createAuthSession({ fetch: server.fetch });
    await session.start();
    await session.login('viewer@rulestudio.dev', PASSWORD);
    server.expireAccessToken();

    const results = await Promise.all([
      session.api.get('/api/rulesets'),
      session.api.get('/api/rulesets'),
      session.api.get('/api/rulesets'),
    ]);

    expect(results).toEqual([[], [], []]);
    expect(count(server.calls, 'POST /api/auth/refresh')).toBe(2); // 1 at start + 1 for the expiry
    expect(session.getState().status).toBe('signedIn');
  });

  it('signs out when the session cannot be refreshed', async () => {
    const server = createFakeApi({ signedInAs: 'viewer@rulestudio.dev' });
    const session = createAuthSession({ fetch: server.fetch });
    await session.start();
    server.expireAccessToken();
    server.cookieFor = null; // refresh token revoked or expired

    await expect(session.api.get('/api/rulesets')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(session.getState().status).toBe('signedOut');
  });

  it('logs out on the server and locally', async () => {
    const server = createFakeApi({ signedInAs: 'viewer@rulestudio.dev' });
    const session = createAuthSession({ fetch: server.fetch });
    await session.start();
    await session.logout();
    expect(server.calls).toContain('POST /api/auth/logout');
    expect(session.getState().status).toBe('signedOut');
  });

  it('is signed out locally even when the logout request fails', async () => {
    const server = createFakeApi({ signedInAs: 'viewer@rulestudio.dev' });
    let offline = false;
    const session = createAuthSession({
      fetch: (input, init) =>
        offline
          ? Promise.reject(new TypeError('offline'))
          : server.fetch(input, init),
    });
    await session.start();
    offline = true;
    await expect(session.logout()).rejects.toThrow();
    expect(session.getState().status).toBe('signedOut');
  });

  it('gives remotes a host with the user, permissions and the API client, but no token or email', async () => {
    const server = createFakeApi({ signedInAs: 'viewer@rulestudio.dev' });
    const session = createAuthSession({ fetch: server.fetch });
    await session.start();
    const host = session.getHost();

    expect(host?.user).toEqual({
      id: 'id-viewer',
      displayName: 'Demo viewer',
      role: 'VIEWER',
    });
    expect(host?.can('ruleset:read')).toBe(true);
    expect(host?.can('ruleset:publish')).toBe(false);
    expect(host?.api).toBe(session.api);
    expect(JSON.stringify(host)).not.toContain('token-');
    expect(session.getHost()).toBe(host); // same object between renders
  });

  it('keeps tokens out of browser storage', async () => {
    const server = createFakeApi();
    const session = createAuthSession({ fetch: server.fetch });
    await session.start();
    await session.login('admin@rulestudio.dev', PASSWORD);
    await session.api.get('/api/rulesets');

    const stored =
      JSON.stringify({ ...localStorage }) +
      JSON.stringify({ ...sessionStorage }) +
      document.cookie;
    expect(server.validToken).toMatch(/^token-/);
    expect(stored).not.toContain(server.validToken);
  });
});

describe('loginErrorMessage', () => {
  it.each([
    [new ApiError(401, undefined), 'Invalid email or password.'],
    [
      new ApiError(429, undefined),
      'Too many sign-in attempts. Wait a minute and try again.',
    ],
    [
      new TypeError('Failed to fetch'),
      'Could not reach the server. Check your connection and try again.',
    ],
    [new Error('?'), 'Something went wrong. Try again.'],
  ])('maps %s to a message', (error, message) => {
    expect(loginErrorMessage(error)).toBe(message);
  });
});
