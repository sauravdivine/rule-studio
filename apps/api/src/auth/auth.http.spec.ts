import { Controller, Get, Post } from '@nestjs/common';
import {
  zAuthResponse,
  zProblemDetails,
  zUser,
} from '@rule-studio/shared-types';
import { createLocalJWKSet, jwtVerify } from 'jose';
import request from 'supertest';
import {
  createTestApp,
  createUser,
  resetDatabase,
  TEST_PASSWORD,
  type TestApp,
} from '../test/test-app';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';
import { RequirePermission } from './decorators/require-permission.decorator';

// Test-only routes, to check the guards: one any signed-in user may call, one editor-only.
@Controller('test/guarded')
class GuardedController {
  @Get('any')
  any() {
    return { ok: true };
  }

  @Post('edit')
  @RequirePermission('ruleset:edit')
  edit() {
    return { ok: true };
  }
}

// Pulls the rs_refresh cookie out of a response's Set-Cookie headers.
function refreshCookieOf(response: request.Response): string | undefined {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith('rs_refresh='));
}
function cookieValue(setCookie: string | undefined): string {
  return (setCookie ?? '').split(';')[0] ?? '';
}

describe('Auth API (HTTP)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [GuardedController] });
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await createUser(t.prisma, 'VIEWER');
    await createUser(t.prisma, 'EDITOR');
    await createUser(t.prisma, 'ADMIN');
  });

  const login = (email = 'viewer@rulestudio.test', password = TEST_PASSWORD) =>
    request(t.server).post('/api/auth/login').send({ email, password });

  describe('POST /api/auth/login', () => {
    it('signs in, returning the contract shape and an HttpOnly refresh cookie', async () => {
      const response = await login();
      expect(response.status).toBe(200);
      expect(zAuthResponse.safeParse(response.body).success).toBe(true);
      expect(response.body.user).toMatchObject({
        email: 'viewer@rulestudio.test',
        role: 'VIEWER',
        permissions: ['ruleset:read', 'simulation:run', 'dashboard:read'],
      });
      expect(response.body.expiresIn).toBe(900);

      const cookie = refreshCookieOf(response);
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth/i);
      expect(cookie).toMatch(/Max-Age=604800/i);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('never returns the refresh token or password hash in the body', async () => {
      const response = await login();
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(
        cookieValue(refreshCookieOf(response)).split('=')[1],
      );
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('$argon2');
    });

    it('ignores the case of the email', async () => {
      expect((await login('Viewer@RuleStudio.TEST')).status).toBe(200);
    });

    it('stores only a hash of the refresh token', async () => {
      const response = await login();
      const token = cookieValue(refreshCookieOf(response)).split('=')[1];
      const rows = await t.prisma.refreshToken.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).not.toBe(token);
      expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await login(
        'viewer@rulestudio.test',
        'wrong-password',
      );
      const unknownEmail = await login(
        'nobody@rulestudio.test',
        'wrong-password',
      );
      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.detail).toBe('Invalid email or password.');
      expect(refreshCookieOf(wrongPassword)).toBeUndefined();
    });

    it('rejects an invalid body with a problem-details 400', async () => {
      const response = await request(t.server)
        .post('/api/auth/login')
        .send({ email: 'not-an-email' });
      expect(response.status).toBe(400);
      expect(zProblemDetails.safeParse(response.body).success).toBe(true);
    });
  });

  describe('rate limiting', () => {
    let limited: TestApp;
    beforeAll(async () => {
      limited = await createTestApp({
        config: { LOGIN_RATE_LIMIT_PER_MINUTE: 5 },
      });
    });
    afterAll(async () => {
      await limited.app.close();
    });

    it('answers the sixth attempt within a minute with 429 and Retry-After', async () => {
      const attempt = () =>
        request(limited.server).post('/api/auth/login').send({
          email: 'viewer@rulestudio.test',
          password: 'wrong-password',
        });
      for (let i = 0; i < 5; i++) {
        expect((await attempt()).status).toBe(401);
      }
      const sixth = await attempt();
      expect(sixth.status).toBe(429);
      expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);
      expect(sixth.headers['content-type']).toMatch(
        /application\/problem\+json/,
      );
      expect(sixth.body).toMatchObject({
        status: 429,
        title: 'Too Many Requests',
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('exchanges the cookie for a new access token and a new refresh cookie', async () => {
      const first = await login();
      const oldCookie = cookieValue(refreshCookieOf(first));

      const refreshed = await request(t.server)
        .post('/api/auth/refresh')
        .set('Cookie', oldCookie);
      expect(refreshed.status).toBe(200);
      expect(zAuthResponse.safeParse(refreshed.body).success).toBe(true);
      const newCookie = cookieValue(refreshCookieOf(refreshed));
      expect(newCookie).toMatch(/^rs_refresh=.+/);
      expect(newCookie).not.toBe(oldCookie);
    });

    it('rejects a missing cookie with 401', async () => {
      expect((await request(t.server).post('/api/auth/refresh')).status).toBe(
        401,
      );
    });

    it('rejects a made-up cookie with 401', async () => {
      const response = await request(t.server)
        .post('/api/auth/refresh')
        .set('Cookie', 'rs_refresh=made-up');
      expect(response.status).toBe(401);
    });

    it('rejects an expired refresh token', async () => {
      const cookie = cookieValue(refreshCookieOf(await login()));
      await t.prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const response = await request(t.server)
        .post('/api/auth/refresh')
        .set('Cookie', cookie);
      expect(response.status).toBe(401);
    });

    it('treats reuse of an old refresh token as theft and revokes every session', async () => {
      const cookie1 = cookieValue(refreshCookieOf(await login()));
      const second = await request(t.server)
        .post('/api/auth/refresh')
        .set('Cookie', cookie1);
      const cookie2 = cookieValue(refreshCookieOf(second));
      // A second session for the same user, on another device.
      const otherDevice = cookieValue(refreshCookieOf(await login()));

      // The attacker replays the first (already used) token.
      const replay = await request(t.server)
        .post('/api/auth/refresh')
        .set('Cookie', cookie1);
      expect(replay.status).toBe(401);

      // Every session of that user is now revoked, including the legitimate ones.
      for (const cookie of [cookie2, otherDevice]) {
        const response = await request(t.server)
          .post('/api/auth/refresh')
          .set('Cookie', cookie);
        expect(response.status).toBe(401);
      }
      const active = await t.prisma.refreshToken.count({
        where: { revokedAt: null },
      });
      expect(active).toBe(0);
    });

    it('lets only one of two simultaneous refreshes with the same token succeed', async () => {
      const cookie = cookieValue(refreshCookieOf(await login()));
      const results = await Promise.all([
        request(t.server).post('/api/auth/refresh').set('Cookie', cookie),
        request(t.server).post('/api/auth/refresh').set('Cookie', cookie),
      ]);
      expect(
        results.filter((response) => response.status === 200).length,
      ).toBeLessThanOrEqual(1);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const cookie = cookieValue(refreshCookieOf(await login()));
      const response = await request(t.server)
        .post('/api/auth/logout')
        .set('Cookie', cookie);
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(refreshCookieOf(response)).toMatch(/rs_refresh=;/);
      expect(refreshCookieOf(response)).toMatch(/Expires=Thu, 01 Jan 1970/i);

      const refresh = await request(t.server)
        .post('/api/auth/refresh')
        .set('Cookie', cookie);
      expect(refresh.status).toBe(401);
    });

    it('succeeds with no cookie at all', async () => {
      expect((await request(t.server).post('/api/auth/logout')).status).toBe(
        204,
      );
    });

    it('succeeds with an unknown cookie', async () => {
      const response = await request(t.server)
        .post('/api/auth/logout')
        .set('Cookie', 'rs_refresh=unknown');
      expect(response.status).toBe(204);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the signed-in user', async () => {
      const { accessToken } = (await login('editor@rulestudio.test')).body;
      const response = await request(t.server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(response.status).toBe(200);
      expect(zUser.safeParse(response.body).success).toBe(true);
      expect(response.body).toMatchObject({
        email: 'editor@rulestudio.test',
        role: 'EDITOR',
      });
    });

    it('requires an access token', async () => {
      const response = await request(t.server).get('/api/auth/me');
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(
        /application\/problem\+json/,
      );
    });
  });

  describe('guards', () => {
    it('answers 401 with no token and with a garbage token', async () => {
      expect((await request(t.server).get('/test/guarded/any')).status).toBe(
        401,
      );
      const garbage = await request(t.server)
        .get('/test/guarded/any')
        .set('Authorization', 'Bearer not.a.jwt');
      expect(garbage.status).toBe(401);
    });

    it('lets any signed-in user through a route without a permission', async () => {
      const { accessToken } = (await login()).body;
      const response = await request(t.server)
        .get('/test/guarded/any')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(response.status).toBe(200);
    });

    it('answers 403 when a viewer calls an editor-only route', async () => {
      const { accessToken } = (await login('viewer@rulestudio.test')).body;
      const response = await request(t.server)
        .post('/test/guarded/edit')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ status: 403, title: 'Forbidden' });
    });

    it('lets editors and admins through the editor-only route', async () => {
      for (const email of ['editor@rulestudio.test', 'admin@rulestudio.test']) {
        const { accessToken } = (await login(email)).body;
        const response = await request(t.server)
          .post('/test/guarded/edit')
          .set('Authorization', `Bearer ${accessToken}`);
        expect(response.status).toBe(201);
      }
    });
  });

  describe('GET /.well-known/jwks.json', () => {
    it('publishes a key that verifies the API’s access tokens', async () => {
      const jwks = await request(t.server).get('/.well-known/jwks.json');
      expect(jwks.status).toBe(200);
      expect(jwks.body.keys).toHaveLength(1);
      expect(jwks.body.keys[0]).toMatchObject({
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig',
        kid: 'test-key',
      });
      expect(jwks.body.keys[0]).not.toHaveProperty('d'); // the private part

      const { accessToken } = (await login()).body;
      const { payload } = await jwtVerify(
        accessToken,
        createLocalJWKSet(jwks.body),
        {
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
        },
      );
      expect(payload['role']).toBe('VIEWER');
    });

    it('needs no access token', async () => {
      expect(
        (await request(t.server).get('/.well-known/jwks.json')).status,
      ).toBe(200);
    });
  });
});
