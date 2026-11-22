import type { AuthResponse, Role, User } from '@rule-studio/shared-types';
import { permissionsFor } from '@rule-studio/permissions';

// A tiny in-memory stand-in for the API's auth endpoints, behaving like the real
// one: rotating refresh "cookie", 401/429 problem details, Bearer checks.
export const PASSWORD = 'correct-horse';

const USERS: Record<string, Role> = {
  'viewer@rulestudio.dev': 'VIEWER',
  'editor@rulestudio.dev': 'EDITOR',
  'admin@rulestudio.dev': 'ADMIN',
};

function userFor(email: string): User {
  const role = USERS[email];
  return {
    id: `id-${role.toLowerCase()}`,
    email,
    displayName: `Demo ${role.toLowerCase()}`,
    role,
    permissions: permissionsFor(role),
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type':
        status >= 400 ? 'application/problem+json' : 'application/json',
    },
  });
}

const problem = (status: number, title: string, detail?: string) =>
  json(status, {
    type: 'about:blank',
    title,
    status,
    ...(detail ? { detail } : {}),
  });

export function createFakeApi(options: { signedInAs?: string } = {}) {
  let tokenCounter = 0;
  const api = {
    // The refresh "cookie": which user it belongs to, or null.
    cookieFor: options.signedInAs ?? (null as string | null),
    validToken: null as string | null,
    calls: [] as string[],
    // Lets a test hold a login response to inspect the in-between state.
    loginGate: null as Promise<void> | null,
    rateLimited: false,
    expireAccessToken() {
      api.validToken = null;
    },
    fetch: async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ): Promise<Response> => {
      const path = typeof input === 'string' ? input : input.toString();
      const method = init.method ?? 'GET';
      api.calls.push(`${method} ${path}`);

      const issue = (email: string): Response => {
        api.cookieFor = email;
        api.validToken = `token-${++tokenCounter}`;
        const body: AuthResponse = {
          accessToken: api.validToken,
          expiresIn: 900,
          user: userFor(email),
        };
        return json(200, body);
      };

      if (method === 'POST' && path === '/api/auth/login') {
        if (api.loginGate) await api.loginGate;
        if (api.rateLimited) return problem(429, 'Too Many Requests');
        const { email, password } = JSON.parse(String(init.body)) as {
          email: string;
          password: string;
        };
        if (!USERS[email] || password !== PASSWORD) {
          return problem(401, 'Unauthorized', 'Invalid email or password');
        }
        return issue(email);
      }
      if (method === 'POST' && path === '/api/auth/refresh') {
        return api.cookieFor
          ? issue(api.cookieFor)
          : problem(401, 'Unauthorized');
      }
      if (method === 'POST' && path === '/api/auth/logout') {
        api.cookieFor = null;
        return new Response(null, { status: 204 });
      }
      // Any other endpoint needs a valid Bearer token.
      const auth = new Headers(init.headers).get('Authorization');
      if (!api.validToken || auth !== `Bearer ${api.validToken}`)
        return problem(401, 'Unauthorized');
      return json(200, []);
    },
  };
  return api;
}
