import {
  ApiError,
  createApiClient,
  isApiError,
  type ApiClientOptions,
} from './api-client.js';

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': type },
  });
const problem = (status: number, title: string, detail?: string) =>
  json(
    status,
    { type: 'about:blank', title, status, detail },
    'application/problem+json',
  );

// A fake API: answers 401 to any request without the currently valid token.
function fakeApi(validToken: { current: string }) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('Authorization');
    return auth === `Bearer ${validToken.current}`
      ? json(200, { ok: true })
      : problem(401, 'Unauthorized');
  });
}

// A promise you resolve by hand, to hold a refresh "in flight".
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(overrides: Partial<ApiClientOptions> = {}) {
  let token: string | null = 'old';
  const options = {
    getAccessToken: vi.fn(() => token),
    refresh: vi.fn(async () => (token = 'new')),
    onSignedOut: vi.fn(),
    ...overrides,
  };
  return { options, setToken: (value: string | null) => (token = value) };
}

describe('createApiClient', () => {
  it('adds the access token and JSON headers', async () => {
    const fetch = vi.fn(async () => json(200, { id: 1 }));
    const api = createApiClient({ ...setup().options, fetch });
    await api.post('/api/rulesets', { name: 'Loans' });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe('/api/rulesets');
    expect(init.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer old');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'Loans' }));
    expect(init.credentials).toBe('same-origin');
  });

  it('sends no Authorization header when signed out', async () => {
    const fetch = vi.fn(async () => json(200, {}));
    const { options, setToken } = setup();
    setToken(null);
    await createApiClient({ ...options, fetch }).get('/api/public');
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('refreshes once on a 401 and retries with the new token', async () => {
    const valid = { current: 'new' };
    const fetch = fakeApi(valid);
    const { options } = setup();
    const result = await createApiClient({ ...options, fetch }).get(
      '/api/rulesets',
    );

    expect(result).toEqual({ ok: true });
    expect(options.refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(options.onSignedOut).not.toHaveBeenCalled();
  });

  it('shares one refresh between parallel 401s (single flight)', async () => {
    const valid = { current: 'new' };
    const fetch = fakeApi(valid);
    const pending = deferred<string>();
    const { options } = setup({ refresh: vi.fn(() => pending.promise) });
    const api = createApiClient({ ...options, fetch });

    const requests = Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    await vi.waitFor(() => expect(options.refresh).toHaveBeenCalled());
    pending.resolve('new');

    expect(await requests).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(options.refresh).toHaveBeenCalledTimes(1);
  });

  it('starts a new refresh for a 401 that comes after the last one finished', async () => {
    const valid = { current: 'new' };
    const fetch = fakeApi(valid);
    let n = 0;
    const { options } = setup({ refresh: vi.fn(async () => `t${++n}`) });
    const api = createApiClient({
      ...options,
      getAccessToken: () => 'stale',
      fetch,
    });

    valid.current = 't1';
    await api.get('/a');
    valid.current = 't2';
    await api.get('/b');
    expect(options.refresh).toHaveBeenCalledTimes(2);
  });

  it('signs out once, and rejects every waiting request, when the refresh fails', async () => {
    const fetch = fakeApi({ current: 'never' });
    const { options } = setup({ refresh: vi.fn(async () => null) });
    const api = createApiClient({ ...options, fetch });

    const results = await Promise.allSettled([api.get('/a'), api.get('/b')]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ApiError,
    );
    expect(options.refresh).toHaveBeenCalledTimes(1);
    expect(options.onSignedOut).toHaveBeenCalledTimes(1);
  });

  it('treats a refresh that throws (e.g. network error) as signed out', async () => {
    const fetch = fakeApi({ current: 'never' });
    const { options } = setup({
      refresh: vi.fn(async () => Promise.reject(new Error('offline'))),
    });
    await expect(
      createApiClient({ ...options, fetch }).get('/a'),
    ).rejects.toBeInstanceOf(ApiError);
    expect(options.onSignedOut).toHaveBeenCalledTimes(1);
  });

  it('signs out without looping when even the new token is refused', async () => {
    const fetch = fakeApi({ current: 'never' });
    const { options } = setup();
    await expect(
      createApiClient({ ...options, fetch }).get('/a'),
    ).rejects.toMatchObject({ status: 401 });
    expect(options.refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(options.onSignedOut).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for a 401 from login (wrong password)', async () => {
    const fetch = vi.fn(async () =>
      problem(401, 'Unauthorized', 'Invalid email or password.'),
    );
    const { options } = setup();
    const error = await createApiClient({ ...options, fetch })
      .post('/api/auth/login', { email: 'a@b.dev', password: 'x' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Invalid email or password.');
    expect(options.refresh).not.toHaveBeenCalled();
    expect(options.onSignedOut).not.toHaveBeenCalled();
  });

  it('turns an error response into an ApiError with the problem details', async () => {
    const fetch = vi.fn(async () =>
      problem(
        403,
        'Forbidden',
        'You do not have permission to do this (ruleset:edit).',
      ),
    );
    const error = (await createApiClient({ ...setup().options, fetch })
      .post('/api/rulesets')
      .catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(403);
    expect(error.problem).toMatchObject({ title: 'Forbidden', status: 403 });
    expect(error.message).toContain('ruleset:edit');
  });

  it('copes with an error response that is not JSON', async () => {
    const fetch = vi.fn(
      async () => new Response('Bad Gateway', { status: 502 }),
    );
    const error = (await createApiClient({ ...setup().options, fetch })
      .get('/a')
      .catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.problem).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    expect(
      await createApiClient({ ...setup().options, fetch }).delete('/a'),
    ).toBeUndefined();
  });

  it('prefixes paths with baseUrl', async () => {
    const fetch = vi.fn(async () => json(200, {}));
    await createApiClient({
      ...setup().options,
      fetch,
      baseUrl: 'https://api.example.dev',
    }).get('/x');
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://api.example.dev/x');
  });

  it('sends extra headers such as If-Match, and keeps them on the retry after a refresh', async () => {
    const valid = { current: 'new' };
    const fetch = fakeApi(valid);
    const api = createApiClient({ ...setup().options, fetch });
    await api.put(
      '/api/rulesets/1/draft',
      { a: 1 },
      { headers: { 'If-Match': '"3"' } },
    );

    expect(fetch).toHaveBeenCalledTimes(2); // 401 with the old token, then the retry
    for (const [, init] of fetch.mock.calls as unknown as Array<
      [string, RequestInit]
    >) {
      expect(new Headers(init.headers).get('If-Match')).toBe('"3"');
    }
  });

  it('never lets extra headers replace the ones it owns', async () => {
    const fetch = vi.fn(async () => json(200, {}));
    await createApiClient({ ...setup().options, fetch }).get('/x', {
      headers: { Accept: 'text/html' },
    });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it('passes the abort signal to fetch', async () => {
    const fetch = vi.fn(async () => json(200, {}));
    const controller = new AbortController();
    await createApiClient({ ...setup().options, fetch }).get('/x', {
      signal: controller.signal,
    });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it('recognises an ApiError from another copy of this library (isApiError)', () => {
    // What a remote sees: an error built by the shell's copy of the class.
    class OtherCopyApiError extends Error {
      constructor(readonly status: number) {
        super('x');
        this.name = 'ApiError';
      }
    }
    const fromShell = new OtherCopyApiError(412);
    expect(fromShell instanceof ApiError).toBe(false);
    expect(isApiError(fromShell)).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });
});
