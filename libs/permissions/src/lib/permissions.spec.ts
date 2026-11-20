import { zPermission } from '@rule-studio/shared-types';
import type { Permission, Role } from '@rule-studio/shared-types';
import { ROLE_PERMISSIONS, can, permissionsFor } from './permissions.js';

// Every permission defined in contracts/openapi.yaml.
const ALL_PERMISSIONS: readonly Permission[] = zPermission.options;

// Spec 002, "Users, roles and permissions": exactly what each role may do.
const EXPECTED: Record<Role, readonly Permission[]> = {
  VIEWER: ['ruleset:read', 'simulation:run', 'dashboard:read'],
  EDITOR: [
    'ruleset:read',
    'simulation:run',
    'dashboard:read',
    'ruleset:edit',
    'ruleset:publish',
  ],
  ADMIN: [
    'ruleset:read',
    'simulation:run',
    'dashboard:read',
    'ruleset:edit',
    'ruleset:publish',
    'ruleset:pin',
    'ruleset:archive',
    'user:manage',
  ],
};

const ROLES = Object.keys(EXPECTED) as Role[];

describe('can', () => {
  // One test per role and permission: 3 × 8 = 24 cases, so a wrong entry names itself.
  describe.each(ROLES)('%s', (role) => {
    it.each(ALL_PERMISSIONS)(`%s`, (permission) => {
      expect(can(role, permission)).toBe(EXPECTED[role].includes(permission));
    });
  });

  it('lets only admins pin the live version', () => {
    expect(ROLES.filter((role) => can(role, 'ruleset:pin'))).toEqual(['ADMIN']);
  });
});

describe('role hierarchy', () => {
  it('gives editors everything viewers have', () => {
    for (const permission of ROLE_PERMISSIONS.VIEWER) {
      expect(can('EDITOR', permission)).toBe(true);
    }
  });

  it('gives admins everything editors have', () => {
    for (const permission of ROLE_PERMISSIONS.EDITOR) {
      expect(can('ADMIN', permission)).toBe(true);
    }
  });
});

describe('coverage of the contract', () => {
  // Fails if a permission is added to openapi.yaml but never granted to anyone.
  it('grants every contract permission to at least one role', () => {
    const granted = new Set(ROLES.flatMap((role) => ROLE_PERMISSIONS[role]));
    const missing = ALL_PERMISSIONS.filter(
      (permission) => !granted.has(permission),
    );
    expect(missing).toEqual([]);
  });

  it('has an entry for every role in the contract', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
  });
});

describe('permissionsFor', () => {
  it('returns the role’s permissions without duplicates', () => {
    const permissions = permissionsFor('ADMIN');
    expect(new Set(permissions).size).toBe(permissions.length);
    expect([...permissions].sort()).toEqual([...EXPECTED.ADMIN].sort());
  });

  it('returns a copy, so callers cannot change the shared map', () => {
    const permissions = permissionsFor('VIEWER');
    permissions.push('user:manage');
    expect(can('VIEWER', 'user:manage')).toBe(false);
    expect(permissionsFor('VIEWER')).not.toContain('user:manage');
  });
});
