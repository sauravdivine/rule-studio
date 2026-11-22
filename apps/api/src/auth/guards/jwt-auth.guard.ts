import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../auth-user';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { TokenService } from '../token.service';

// Registered globally: every route requires a valid access token unless it is @Public().
// On success the caller is available as request.user (and via @CurrentUser()).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    const user =
      scheme === 'Bearer' && token
        ? await this.tokens.verifyAccessToken(token)
        : null;
    if (!user) {
      throw new UnauthorizedException(
        'Missing, invalid or expired access token.',
      );
    }
    request.user = user;
    return true;
  }
}
