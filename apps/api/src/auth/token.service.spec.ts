import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import {
  createLocalJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  SignJWT,
} from 'jose';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';
import { TokenService } from './token.service';
import { TEST_PRIVATE_KEY_PEM } from '../test/test-app';
import type { AppConfig } from '../common/config/env';

const config = {
  JWT_PRIVATE_KEY: TEST_PRIVATE_KEY_PEM,
  JWT_KEY_ID: 'test-key',
  ACCESS_TOKEN_TTL_SECONDS: 900,
} as AppConfig;

const tokens = new TokenService(config);
const viewer = {
  id: '3f0c9a4e-8a5d-4d3b-9c2e-1a2b3c4d5e6f',
  role: 'VIEWER' as const,
};

describe('TokenService', () => {
  it('signs an access token that verifies back to the same user', async () => {
    const token = await tokens.signAccessToken(viewer);
    expect(await tokens.verifyAccessToken(token)).toEqual(viewer);
  });

  it('puts the key id in the header and signs with RS256', async () => {
    const header = decodeProtectedHeader(await tokens.signAccessToken(viewer));
    expect(header).toMatchObject({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  });

  it('issues tokens that verify against the published JWKS', async () => {
    const token = await tokens.signAccessToken(viewer);
    const jwks = createLocalJWKSet({ keys: [tokens.publicJwk()] });
    const { payload } = await jwtVerify(token, jwks, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    expect(payload).toMatchObject({ sub: viewer.id, role: 'VIEWER' });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(900);
  });

  it('never puts the private key in the JWKS', () => {
    expect(Object.keys(tokens.publicJwk()).sort()).toEqual([
      'alg',
      'e',
      'kid',
      'kty',
      'n',
      'use',
    ]);
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ role: 'VIEWER' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(viewer.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(createPrivateKey(TEST_PRIVATE_KEY_PEM));
    expect(await tokens.verifyAccessToken(expired)).toBeNull();
  });

  it('rejects a token signed with a different key', async () => {
    const otherKey = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    }).privateKey;
    const forged = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(viewer.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setExpirationTime('5m')
      .sign(otherKey);
    expect(await tokens.verifyAccessToken(forged)).toBeNull();
  });

  it('rejects a token whose payload was edited', async () => {
    const [header, , signature] = (await tokens.signAccessToken(viewer)).split(
      '.',
    );
    const edited = Buffer.from(
      JSON.stringify({ sub: viewer.id, role: 'ADMIN' }),
    ).toString('base64url');
    expect(
      await tokens.verifyAccessToken(`${header}.${edited}.${signature}`),
    ).toBeNull();
  });

  it('rejects an unsigned token (alg "none")', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        sub: viewer.id,
        role: 'ADMIN',
        iss: TOKEN_ISSUER,
        aud: TOKEN_AUDIENCE,
      }),
    ).toString('base64url');
    expect(await tokens.verifyAccessToken(`${header}.${body}.`)).toBeNull();
  });

  it('rejects a token with a role the contract does not know', async () => {
    const odd = await new SignJWT({ role: 'SUPERUSER' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(viewer.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setExpirationTime('5m')
      .sign(createPrivateKey(TEST_PRIVATE_KEY_PEM));
    expect(await tokens.verifyAccessToken(odd)).toBeNull();
  });

  it('creates unique, unguessable refresh tokens and stores only their hash', () => {
    const a = tokens.newRefreshToken();
    const b = tokens.newRefreshToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(tokens.hashRefreshToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hashRefreshToken(a)).not.toContain(a);
  });
});
