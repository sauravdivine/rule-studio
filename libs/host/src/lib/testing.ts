import type { ApiClient } from '@rule-studio/api-client';
import { can } from '@rule-studio/permissions';
import type { Role } from '@rule-studio/shared-types';
import type { Host } from './host.js';

const notConfigured = (method: string) => () =>
  Promise.reject(
    new Error(
      `api.${method}() was called, but this test host has no API. Pass one to createTestHost().`,
    ),
  );

const noApi: ApiClient = {
  request: notConfigured('request'),
  get: notConfigured('get'),
  post: notConfigured('post'),
  put: notConfigured('put'),
  patch: notConfigured('patch'),
  delete: notConfigured('delete'),
};

// A host for remote tests and for running a remote on its own: real permission
// rules for the given role, and an API that fails loudly unless one is supplied.
export function createTestHost(
  role: Role,
  overrides: { api?: Partial<ApiClient> } = {},
): Host {
  return {
    user: {
      id: `test-${role.toLowerCase()}`,
      displayName: `Demo ${role.toLowerCase()}`,
      role,
    },
    can: (permission) => can(role, permission),
    api: { ...noApi, ...overrides.api },
  };
}
