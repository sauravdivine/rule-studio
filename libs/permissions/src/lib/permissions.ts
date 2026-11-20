import type { Permission, Role } from '@rule-studio/shared-types';

// Which permissions each role has (spec 002). Each role builds on the one before it.
const VIEWER: readonly Permission[] = [
  'ruleset:read',
  'simulation:run',
  'dashboard:read',
];
const EDITOR: readonly Permission[] = [
  ...VIEWER,
  'ruleset:edit',
  'ruleset:publish',
];
const ADMIN: readonly Permission[] = [
  ...EDITOR,
  'ruleset:pin',
  'ruleset:archive',
  'user:manage',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VIEWER,
  EDITOR,
  ADMIN,
};

export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
