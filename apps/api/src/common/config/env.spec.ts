import { generateKeyPairSync } from 'node:crypto';
import { parseEnv } from './env';

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

const valid: Record<string, string | undefined> = {
  DATABASE_URL: 'postgresql://rulestudio:rulestudio@localhost:5432/rulestudio',
  JWT_PRIVATE_KEY: Buffer.from(pem).toString('base64'),
  JWT_KEY_ID: 'test-key',
};

describe('parseEnv', () => {
  it('applies defaults for optional variables', () => {
    expect(parseEnv(valid)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 7,
      LOGIN_RATE_LIMIT_PER_MINUTE: 5,
    });
  });

  it('decodes the base64 private key back into a PEM', () => {
    expect(parseEnv(valid).JWT_PRIVATE_KEY).toBe(pem);
  });

  it('turns numbers from strings into numbers', () => {
    const config = parseEnv({
      ...valid,
      PORT: '4000',
      ACCESS_TOKEN_TTL_SECONDS: '120',
    });
    expect(config.PORT).toBe(4000);
    expect(config.ACCESS_TOKEN_TTL_SECONDS).toBe(120);
  });

  it('refuses to start without DATABASE_URL', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a non-Postgres database URL', () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: 'mysql://localhost:3306/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('refuses to start without a signing key', () => {
    expect(() => parseEnv({ ...valid, JWT_PRIVATE_KEY: undefined })).toThrow(
      /JWT_PRIVATE_KEY/,
    );
  });

  it('rejects a signing key that is not a PEM', () => {
    expect(() =>
      parseEnv({
        ...valid,
        JWT_PRIVATE_KEY: Buffer.from('nope').toString('base64'),
      }),
    ).toThrow(/JWT_PRIVATE_KEY/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('never includes the value of a variable in the error', () => {
    const secret = 'postgres-but-not-a-url-s3cr3t';
    expect(() => parseEnv({ ...valid, DATABASE_URL: secret })).toThrow(
      expect.not.objectContaining({
        message: expect.stringContaining(secret),
      }),
    );
  });
});
