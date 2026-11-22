import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can } from '@rule-studio/permissions';
import type { Permission } from '@rule-studio/shared-types';
import type { AuthUser } from '../auth-user';
import { REQUIRED_PERMISSION } from '../decorators/require-permission.decorator';

// Registered globally, after the JWT guard. A route with @RequirePermission(...) is allowed
// only if the caller's role has that permission (libs/permissions, the same map the UI uses).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !can(user.role, permission)) {
      // 403, not 401: the caller is signed in but not allowed.
      throw new ForbiddenException(
        `You do not have permission to do this (${permission}).`,
      );
    }
    return true;
  }
}
