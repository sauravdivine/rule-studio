import { Injectable, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
} from '@nestjs/throttler';
import type { Response } from 'express';

// Rate-limits sign-in attempts, per IP and per email (two throttlers, set up in AuthModule).
// Only the login route uses it.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    // The library names this header per throttler (Retry-After-login-email); the contract
    // promises a plain Retry-After, in seconds.
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(detail.timeToBlockExpire));
    throw new ThrottlerException(
      'Too many sign-in attempts. Try again in a minute.',
    );
  }
}
