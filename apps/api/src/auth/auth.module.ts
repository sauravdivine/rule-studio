import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { APP_CONFIG } from '../common/config/config.module';
import type { AppConfig } from '../common/config/env';
import { UsersModule } from '../users/users.module';
import { normalizeEmail } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwksController } from './jwks.controller';
import { TokenService } from './token.service';

@Module({
  imports: [
    UsersModule,
    // Two limits on sign-in, both per minute: one per IP address, one per email.
    // Only routes with @UseGuards(LoginThrottlerGuard) use them.
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): ThrottlerModuleOptions => ({
        throttlers: [
          {
            name: 'login-ip',
            ttl: 60_000,
            limit: config.LOGIN_RATE_LIMIT_PER_MINUTE,
          },
          {
            name: 'login-email',
            ttl: 60_000,
            limit: config.LOGIN_RATE_LIMIT_PER_MINUTE,
            getTracker: (request: {
              body?: { email?: unknown };
              ip?: string;
            }) => {
              const email = request.body?.email;
              return typeof email === 'string'
                ? normalizeEmail(email)
                : (request.ip ?? 'unknown');
            },
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController, JwksController],
  providers: [
    AuthService,
    TokenService,
    LoginThrottlerGuard,
    // Order matters: first "who are you?" (401), then "are you allowed?" (403).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
