import type { Role } from '@rule-studio/shared-types';

// Who is making the request, as read from a verified access token.
// The JWT guard puts it on `request.user`; controllers read it with @CurrentUser().
export interface AuthUser {
  id: string;
  role: Role;
}
