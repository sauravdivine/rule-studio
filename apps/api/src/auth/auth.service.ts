import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  type OnModuleInit,
} from '@nestjs/common';
import type { AuthResponse, LoginRequest } from '@rule-studio/shared-types';
import { APP_CONFIG } from '../common/config/config.module';
import type { AppConfig } from '../common/config/env';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { dummyPasswordHash, verifyPassword } from './password';
import { TokenService } from './token.service';

// What a successful login or refresh produces: the JSON body, plus the refresh token
// the controller puts in the cookie (it never appears in the body).
export interface Session {
  body: AuthResponse;
  refreshToken: string;
  refreshTokenMaxAgeMs: number;
}

const INVALID_CREDENTIALS = 'Invalid email or password.';
const INVALID_REFRESH = 'Your session has expired. Please sign in again.';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.refreshTtlMs = config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  }

  // Compute the dummy hash at startup, so the first unknown-email login isn't slower.
  async onModuleInit(): Promise<void> {
    await dummyPasswordHash();
  }

  async login({ email, password }: LoginRequest): Promise<Session> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      // Unknown email: still run a password check, so this takes as long as a wrong password.
      await verifyPassword(await dummyPasswordHash(), password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.startSession(user);
  }

  // Rotation: a refresh token works exactly once. Each use returns a new one.
  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    // Mark it used, but only if nobody used it first. The WHERE makes this atomic, so two
    // requests racing with the same token cannot both succeed.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) {
      // Already used: someone holds a copy of an old token. Assume it was stolen and
      // sign the user out everywhere.
      await this.revokeAllSessions(stored.userId);
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}; all sessions revoked`,
      );
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    return this.startSession(stored.user);
  }

  // Revokes the given refresh token if it is valid. Never fails: the user is signed out either way.
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async startSession(user: User): Promise<Session> {
    const refreshToken = this.tokens.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    const accessToken = await this.tokens.signAccessToken({
      id: user.id,
      role: user.role,
    });
    return {
      body: {
        accessToken,
        expiresIn: this.tokens.accessTokenTtlSeconds,
        user: this.users.toDto(user),
      },
      refreshToken,
      refreshTokenMaxAgeMs: this.refreshTtlMs,
    };
  }
}
