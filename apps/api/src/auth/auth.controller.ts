import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  zLoginRequest,
  type AuthResponse,
  type LoginRequest,
  type User,
} from '@rule-studio/shared-types';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './auth-user';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';
import { AuthService, type Session } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';

// The refresh cookie (contracts/openapi.yaml): JavaScript can't read it (HttpOnly), it only
// travels over HTTPS (Secure; browsers allow it on localhost), it's never sent from another
// site (SameSite=Strict), and only to /api/auth.
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
};

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(zLoginRequest)) body: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.sendSession(await this.auth.login(body), response);
  }

  @Public() // authenticated by the cookie, not the (probably expired) access token
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.sendSession(
      await this.auth.refresh(readRefreshCookie(request)),
      response,
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
  }

  @Get('me')
  async me(@CurrentUser() caller: AuthUser): Promise<User> {
    const user = await this.users.findById(caller.id);
    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }
    return this.users.toDto(user);
  }

  private sendSession(session: Session, response: Response): AuthResponse {
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: session.refreshTokenMaxAgeMs,
    });
    response.setHeader('Cache-Control', 'no-store'); // tokens must never be cached
    return session.body;
  }
}

function readRefreshCookie(request: Request): string | undefined {
  const value: unknown = request.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
