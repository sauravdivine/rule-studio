import type { ProblemDetails } from '@rule-studio/shared-types';

// A thrown API error, carrying the response's problem details (contracts/openapi.yaml).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | undefined,
  ) {
    super(
      problem?.detail ??
        problem?.title ??
        `Request failed with status ${status}`,
    );
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  // The current access token, or null when signed out. Read before every request.
  getAccessToken: () => string | null | undefined;
  // Gets a fresh access token (the shell calls POST /api/auth/refresh). Resolves to the new
  // token, or null if the session is over.
  refresh: () => Promise<string | null>;
  // Called once when a session can't be recovered, so the shell can show the login page.
  onSignedOut: () => void;
  // Prefix for every path. Default '' (same origin, as spec 002 requires).
  baseUrl?: string;
  // Injected in tests; defaults to the browser's fetch.
  fetch?: typeof fetch;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiClient {
  request<T>(method: Method, path: string, body?: unknown): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T = void>(path: string): Promise<T>;
}

// A 401 from these means "wrong credentials" or "session over", not "token expired",
// so they must never trigger a refresh.
const NO_REFRESH_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
];

// Holds no state of its own except the one refresh in progress. The token lives in the
// shell; the client only reads it through getAccessToken (spec 002: shell owns auth state).
export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? '';

  // Single flight: every request that gets a 401 while a refresh is running waits for that
  // same refresh. Refresh tokens rotate, so two parallel refreshes would look like reuse
  // of a stolen token and the API would revoke the session.
  let refreshing: Promise<string | null> | null = null;
  function refreshOnce(): Promise<string | null> {
    refreshing ??= options
      .refresh()
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  let signedOut = false;
  function signOut(): void {
    if (!signedOut) {
      signedOut = true;
      options.onSignedOut();
    }
  }

  async function send(
    method: Method,
    path: string,
    body: unknown,
    token: string | null | undefined,
  ) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    return doFetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  }

  async function request<T>(
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let response = await send(method, path, body, options.getAccessToken());

    if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
      // Probably an expired access token: refresh once, then retry once.
      const token = await refreshOnce();
      if (!token) {
        signOut();
        throw await toError(response);
      }
      response = await send(method, path, body, token);
      if (response.status === 401) {
        signOut(); // a brand-new token was refused: the session is gone
      }
    }

    if (response.ok) {
      signedOut = false;
      return (await parseBody(response)) as T;
    }
    throw await toError(response);
  }

  return {
    request,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
  };
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  const type = response.headers.get('content-type') ?? '';
  return type.includes('json') ? response.json() : response.text();
}

async function toError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails | undefined;
  try {
    const body = await parseBody(response);
    if (
      body &&
      typeof body === 'object' &&
      'status' in body &&
      'title' in body
    ) {
      problem = body as ProblemDetails;
    }
  } catch {
    // not JSON: leave problem undefined
  }
  return new ApiError(response.status, problem);
}
