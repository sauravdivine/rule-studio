import {
  ApiError,
  createApiClient,
  type ApiClient,
} from '@rule-studio/api-client';
import { can } from '@rule-studio/permissions';
import type { AuthResponse, Permission, User } from '@rule-studio/shared-types';
import type { Host } from '@rule-studio/host';

// Spec 002: the shell owns all auth state. It lives in this closure and nowhere
// else: never in localStorage, sessionStorage or a readable cookie. A page
// reload wipes it, and the HttpOnly refresh cookie gets a new access token.

export type SessionState =
  | { status: 'loading' } // first refresh not answered yet
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User };

export interface AuthSession {
  getState(): SessionState;
  subscribe(listener: () => void): () => void;
  // Restores a session from the refresh cookie. Safe to call more than once.
  start(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  // The API client remotes use. Same client for the whole page.
  api: ApiClient;
  // The `host` prop for remotes, or null when signed out. Stable between
  // renders until the user changes.
  getHost(): Host | null;
}

export function createAuthSession(
  options: { fetch?: typeof fetch } = {},
): AuthSession {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  let accessToken: string | null = null;
  let state: SessionState = { status: 'loading' };
  let host: Host | null = null;
  const listeners = new Set<() => void>();

  function setState(next: SessionState): void {
    state = next;
    host = null; // rebuilt lazily for the new user
    listeners.forEach((listener) => listener());
  }

  function signIn(response: AuthResponse): string {
    accessToken = response.accessToken;
    setState({ status: 'signedIn', user: response.user });
    return response.accessToken;
  }

  function signOut(): void {
    accessToken = null;
    if (state.status !== 'signedOut') setState({ status: 'signedOut' });
  }

  async function post(path: string, body?: unknown): Promise<Response> {
    return doFetch(path, {
      method: 'POST',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin', // sends the refresh cookie; it is scoped to /api/auth
    });
  }

  // Single flight. Refresh tokens rotate, so two refreshes at once would present
  // the same token twice, which the API treats as theft and revokes every
  // session. This matters on page load: React StrictMode runs effects twice in
  // development, and remotes may make API calls while the first refresh runs.
  let refreshing: Promise<string | null> | null = null;
  function refresh(): Promise<string | null> {
    refreshing ??= (async () => {
      try {
        const response = await post('/api/auth/refresh');
        if (!response.ok) {
          signOut();
          return null;
        }
        return signIn((await response.json()) as AuthResponse);
      } catch {
        signOut(); // network error: treat as signed out, the login page explains
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  const api = createApiClient({
    getAccessToken: () => accessToken,
    refresh,
    onSignedOut: signOut,
    fetch: doFetch,
  });

  let started: Promise<void> | null = null;

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      started ??= refresh().then(() => undefined);
      return started;
    },
    async login(email, password) {
      // Through the API client so errors arrive as ApiError with problem details.
      // Login is on its no-refresh list, so a 401 here never triggers a refresh.
      const response = await api.post<AuthResponse>('/api/auth/login', {
        email,
        password,
      });
      signIn(response);
    },
    async logout() {
      try {
        await post('/api/auth/logout'); // revokes the refresh token, clears the cookie
      } finally {
        signOut(); // signed out locally even if the request failed
      }
    },
    api,
    getHost() {
      if (state.status !== 'signedIn') return null;
      if (!host) {
        const { id, displayName, role } = state.user;
        host = {
          user: { id, displayName, role },
          can: (permission: Permission) => can(role, permission),
          api,
        };
      }
      return host;
    },
  };
}

// Turns a failed login into the message the login form shows.
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 429)
      return 'Too many sign-in attempts. Wait a minute and try again.';
    if (error.status === 400)
      return 'Check the email and password and try again.';
  }
  if (error instanceof TypeError)
    return 'Could not reach the server. Check your connection and try again.';
  return 'Something went wrong. Try again.';
}
