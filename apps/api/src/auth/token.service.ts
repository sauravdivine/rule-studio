import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { zRole, type Jwk } from '@rule-studio/shared-types';
import { jwtVerify, SignJWT } from 'jose';
import { APP_CONFIG } from '../common/config/config.module';
import type { AppConfig } from '../common/config/env';
import type { AuthUser } from './auth-user';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';

// Access tokens (RS256 JWTs) and refresh tokens (random opaque values).
@Injectable()
export class TokenService {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly keyId: string;
  readonly accessTokenTtlSeconds: number;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.privateKey = createPrivateKey(config.JWT_PRIVATE_KEY);
    // The public half is derived from the private key, so only one secret is configured.
    this.publicKey = createPublicKey(this.privateKey);
    this.keyId = config.JWT_KEY_ID;
    this.accessTokenTtlSeconds = config.ACCESS_TOKEN_TTL_SECONDS;
  }

  // A short-lived JWT. Claims: sub (user id), role, iss, aud, iat, exp; header carries kid.
  signAccessToken(user: AuthUser): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'RS256', kid: this.keyId, typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTokenTtlSeconds}s`)
      .sign(this.privateKey);
  }

  // Checks signature, algorithm, issuer, audience and expiry. Returns null for any bad token.
  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: ['RS256'], // never accept "none" or a symmetric algorithm
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const role = zRole.safeParse(payload['role']);
      if (!payload.sub || !role.success) {
        return null;
      }
      return { id: payload.sub, role: role.data };
    } catch {
      return null;
    }
  }

  // The public key in JWK form, for GET /.well-known/jwks.json.
  publicJwk(): Jwk {
    const jwk = this.publicKey.export({ format: 'jwk' });
    return {
      kty: 'RSA',
      kid: this.keyId,
      use: 'sig',
      alg: 'RS256',
      n: String(jwk.n),
      e: String(jwk.e),
    };
  }

  // 32 random bytes: far too many possibilities to guess, so a fast hash is enough to store it.
  newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  // Only this hash is saved. A database leak does not reveal usable refresh tokens.
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
