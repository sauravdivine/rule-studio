import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@rule-studio/shared-types';

export const REQUIRED_PERMISSION = 'requiredPermission';

// Declares what a route needs, e.g. @RequirePermission('ruleset:publish').
// The permissions guard checks it against libs/permissions; code never checks role names.
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
