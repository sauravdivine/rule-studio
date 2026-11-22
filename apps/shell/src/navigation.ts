import type { Permission } from '@rule-studio/shared-types';

// One entry per remote. A user only sees the sections their permissions allow
// (spec 002: role-aware UI), and a route they can't use shows "not allowed".
export interface Section {
  path: string;
  label: string;
  remote: string; // alias in mf.ts
  remoteName: string; // shown in loading and error messages
  permission: Permission;
}

export const SECTIONS: readonly Section[] = [
  {
    path: '/rulesets',
    label: 'Rulesets',
    remote: 'rule-editor',
    remoteName: 'Rule editor',
    permission: 'ruleset:read',
  },
  {
    path: '/simulator',
    label: 'Simulator',
    remote: 'simulator',
    remoteName: 'Simulator',
    permission: 'simulation:run',
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    remote: 'dashboard',
    remoteName: 'Dashboard',
    permission: 'dashboard:read',
  },
];

export function visibleSections(
  can: (permission: Permission) => boolean,
): Section[] {
  return SECTIONS.filter((section) => can(section.permission));
}

// Where to go after sign-in. Only same-app paths, never a full URL, so a
// crafted link can't bounce the user to another site (open redirect).
export function safeReturnPath(path: unknown): string {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/login')
  ) {
    return SECTIONS[0].path;
  }
  return path;
}
