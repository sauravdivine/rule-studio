import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { zProblemDetails } from '@rule-studio/shared-types';
import { ProblemDetailsFilter } from './problem-details.filter';

// A fake Express request/response pair, so the filter can be tested without a server.
function fakeHost(path = '/api/rulesets') {
  const response = {
    statusCode: 0,
    contentType: '',
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    type(value: string) {
      this.contentType = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ path }),
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function run(exception: unknown, path?: string) {
  const { host, response } = fakeHost(path);
  new ProblemDetailsFilter().catch(exception, host);
  return response;
}

describe('ProblemDetailsFilter', () => {
  // The filter logs 500s; keep the test output clean.
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the problem+json content type', () => {
    expect(run(new NotFoundException()).contentType).toBe(
      'application/problem+json',
    );
  });

  it('turns an HttpException into problem details matching the contract', () => {
    const response = run(
      new NotFoundException('Ruleset not found'),
      '/api/rulesets/42',
    );
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Ruleset not found',
      instance: '/api/rulesets/42',
    });
    expect(zProblemDetails.safeParse(response.body).success).toBe(true);
  });

  it('uses the standard HTTP title for the status code', () => {
    expect(run(new ForbiddenException()).body).toMatchObject({
      status: 403,
      title: 'Forbidden',
    });
  });

  it('keeps extra fields such as validation errors', () => {
    const errors = [{ path: 'email', message: 'Invalid email address' }];
    const response = run(
      new BadRequestException({ detail: 'The request is invalid.', errors }),
    );
    expect(response.body).toMatchObject({
      status: 400,
      title: 'Bad Request',
      detail: 'The request is invalid.',
      errors,
    });
  });

  it('does not leak Nest’s own fields (statusCode, error, message)', () => {
    const body = run(new NotFoundException('Gone')).body as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('error');
    expect(body).not.toHaveProperty('message');
  });

  it('handles an HttpException created with a plain string', () => {
    expect(run(new HttpException('Slow down', 429)).body).toMatchObject({
      status: 429,
      title: 'Too Many Requests',
      detail: 'Slow down',
    });
  });

  it('turns an unexpected error into a 500 without revealing its message', () => {
    const response = run(new Error('connection to db-prod-7 refused'));
    expect(response.statusCode).toBe(500);
    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    expect(JSON.stringify(response.body)).not.toContain('db-prod-7');
  });

  it('handles things that are not even Errors', () => {
    expect(run('something odd').statusCode).toBe(500);
  });
});
