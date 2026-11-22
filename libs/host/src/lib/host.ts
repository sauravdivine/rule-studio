import type { ApiClient } from '@rule-studio/api-client';
import type { Permission, Role } from '@rule-studio/shared-types';

// Spec 002: what the shell gives every remote. Capabilities, not state: a remote
// never sees a token, a cookie or the refresh logic, and never imports the
// shell's auth code. Everything arrives through this one prop.
export interface Host {
  // Who is signed in. No email or token: remotes don't need them.
  user: HostUser;
  // Whether the user may do something. Use it to hide actions that would 403.
  can: (permission: Permission) => boolean;
  // A ready-made API client. Adds the token and refreshes it; remotes just call it.
  api: ApiClient;
}

export interface HostUser {
  id: string;
  displayName: string;
  role: Role;
}

// Props of every remote's exposed App.
export interface HostProps {
  host: Host;
}
