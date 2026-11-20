import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://rulestudio:rulestudio@localhost:5432/rulestudio',
};

describe('parseEnv', () => {
  it('applies defaults for optional variables', () => {
    expect(parseEnv(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: valid.DATABASE_URL,
    });
  });

  it('turns PORT into a number', () => {
    expect(parseEnv({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  });

  it('refuses to start without DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres database URL', () => {
    expect(() =>
      parseEnv({ DATABASE_URL: 'mysql://localhost:3306/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('never includes the value of a variable in the error', () => {
    const secret = 'postgres-but-not-a-url-s3cr3t';
    expect(() => parseEnv({ DATABASE_URL: secret })).toThrow(
      expect.not.objectContaining({
        message: expect.stringContaining(secret),
      }),
    );
  });
});
