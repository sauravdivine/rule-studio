# 002 · Auth

**Status:** Approved
**Contract:** `contracts/openapi.yaml` (created by this spec; first API contract)
**Depends on:** 001 (approved)

## Goal

Users sign in, the frontend and backend both know who they are and what they may do, and every API call is authorised. This spec also bootstraps the NestJS backend that later specs build on.

## User stories

- As a user, I sign in with email and password, and stay signed in across page reloads until I sign out or my session expires.
- As a viewer, I can browse rulesets and run the simulator, but cannot change anything.
- As an editor, I can create and edit drafts and publish versions.
- As an admin, I can also choose which version is live, archive rulesets, and manage users.
- As any user, I only see the actions my role allows; the backend refuses the rest even if the UI is bypassed.

## Users, roles and permissions

There is no public sign-up. Three demo users are seeded so recruiters can try the app; user management is deferred.

| Role     | Permissions                                                    |
| -------- | -------------------------------------------------------------- |
| `VIEWER` | `ruleset:read`, `simulation:run`, `dashboard:read`             |
| `EDITOR` | Viewer's, plus `ruleset:edit`, `ruleset:publish`               |
| `ADMIN`  | Editor's, plus `ruleset:pin`, `ruleset:archive`, `user:manage` |

- A user has exactly one role.
- The role-to-permission map lives in one shared library, `libs/permissions`. The backend uses it to authorise requests; the frontend uses it to decide what to show. The two can never disagree.
- Code checks **permissions**, never role names, so roles can change without touching features.
- There is one shared workspace: every signed-in user sees every ruleset, and ruleset names are unique across the workspace.

## How sign-in works

### Tokens

- **Access token:** a JWT, valid for **15 minutes**, sent as `Authorization: Bearer <token>`. Kept **in memory only** in the browser, never in localStorage or sessionStorage.
- **Refresh token:** a random opaque value, valid for **7 days**, stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/auth`. JavaScript cannot read it.
- The backend stores only a hash of each refresh token, so a session can be revoked.
- **Rotation:** every refresh issues a new refresh token and invalidates the old one. If an already-used token is presented again, all of that user's sessions are revoked (a stolen token is detected).

### Signing

- Access tokens are signed with **RS256**. The backend signs with a private key and publishes the public key at `/.well-known/jwks.json`, so any other service could verify tokens without sharing a secret.
- Each key has a key id (`kid`) in the token header, so keys can be rotated later.
- Keys come from environment variables, never from code. A script generates a local key pair for development into a git-ignored `.env`.

### Flow

1. **Login:** `POST /api/auth/login` with email and password → access token in the body, refresh cookie set.
2. **API calls:** the access token goes in the `Authorization` header.
3. **Page load or expired token:** `POST /api/auth/refresh` (the cookie is sent automatically) → new access token and rotated cookie. If it fails, the user goes to the login page.
4. **Logout:** `POST /api/auth/logout` → refresh token revoked, cookie cleared, in-memory token dropped.

### Same origin

The refresh cookie only works reliably when the frontend and API share an origin; browsers increasingly block cross-site cookies.

- **Local:** Vite proxies `/api` and `/.well-known` from the shell to the API on `:3000`.
- **Deployed:** the frontend host forwards these paths to the API (decided in the deployment spec).

The API therefore does not need cross-origin cookies, and CORS stays closed.

## API (goes into `contracts/openapi.yaml`)

| Method | Path                     | Auth           | Success                                                 | Errors                                                       |
| ------ | ------------------------ | -------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| POST   | `/api/auth/login`        | none           | 200 `{ accessToken, expiresIn, user }` + cookie         | 400 invalid body, 401 bad credentials, 429 too many attempts |
| POST   | `/api/auth/refresh`      | refresh cookie | 200 `{ accessToken, expiresIn, user }` + rotated cookie | 401 missing, expired or revoked                              |
| POST   | `/api/auth/logout`       | refresh cookie | 204, cookie cleared                                     | none (always succeeds)                                       |
| GET    | `/api/auth/me`           | access token   | 200 `user`                                              | 401                                                          |
| GET    | `/.well-known/jwks.json` | none           | 200 public key set                                      |                                                              |

`user` = `{ id, email, displayName, role, permissions }`.

Errors use one shape across the whole API (RFC 9457 problem details): `{ type, title, status, detail }`.

The contract is written by hand. TypeScript types are generated from it into `libs/shared-types`, and the request validators are generated or derived from it, so the API cannot drift from the contract.

## Security rules

- Passwords hashed with **Argon2** (argon2id).
- Login failures always return the same message, "Invalid email or password", so attackers cannot tell which emails exist. Unknown emails still take the same time as wrong passwords.
- Login is rate-limited: 5 attempts per minute per IP and per email, then 429.
- Every endpoint except login, refresh, logout and JWKS requires a valid access token.
- 401 means "not signed in"; 403 means "signed in, but not allowed".
- No tokens, passwords or refresh values in logs.
- CSRF: API calls use the `Authorization` header, which browsers never attach automatically. The cookie endpoints rely on `SameSite=Strict` and same-origin.

## Frontend

### Routing and sign-in

- The shell adds **React Router**, with `/login` plus a route per remote (`/rulesets`, `/simulator`, `/dashboard`). Unauthenticated users are redirected to `/login` and returned to the page they wanted after signing in.
- **Login page** in the shell: email, password, inline error, button disabled while submitting, and three "Sign in as demo viewer / editor / admin" buttons.
- On load the shell calls `/refresh` and shows a loading screen until it knows whether the user is signed in.

### How remotes get auth

The **shell owns all auth state**: the access token, the user, and the single in-progress refresh. Each remote receives one `host` prop:

```ts
host = {
  user, // { id, displayName, role }
  can, // can('ruleset:publish') → boolean, from libs/permissions
  api, // ready-made API client
};
```

- Remotes never see a token, a cookie or the refresh logic. They call `host.api.get('/api/rulesets')`.
- There is no shared auth store or context across micro frontends, because Module Federation can silently duplicate them. Capabilities are shared, not state.
- In tests, a remote gets a fake `api` and `can`.

### API client

- `libs/api-client` exports a **stateless** `createApiClient({ getAccessToken, refresh, onSignedOut })`. Only the shell creates the client.
- It adds the `Authorization` header. On a 401 it calls `refresh` once and retries; if that fails, it signs the user out.
- Concurrent 401s, from any remote, share one refresh call. This matters because refresh tokens rotate: two parallel refreshes would look like token reuse and revoke the session.

### Role-aware UI

Navigation and buttons use `can(...)`, so a user never sees an action that would return 403.

## Backend bootstrap (part of this spec)

- **NestJS** on Node 22+, as an Nx app in `apps/api` (generated with `@nx/nest`). The old `backend/` folder is removed.
- **PostgreSQL** via `docker compose` for local development.
- **Prisma** for the schema, migrations and seeding.
- Modules: `auth`, `users`, `common` (config, error filter, validation).
- A global exception filter returns problem details for every error.
- **Guards:** a JWT guard that verifies access tokens with `jose` (the same library that signs them and serves JWKS), and a permissions guard driven by a `@RequirePermission(...)` decorator and `libs/permissions`.
- `@nestjs/throttler` for login rate limiting; `cookie-parser` for the refresh cookie.
- **Data:** `User` (id, email, displayName, role, passwordHash, createdAt) and `RefreshToken` (id, userId, tokenHash, expiresAt, usedAt, revokedAt, createdAt).
- The seed creates `viewer@rulestudio.dev`, `editor@rulestudio.dev` and `admin@rulestudio.dev`; demo passwords come from environment variables.
- `nx serve api` and `nx test api` work from the repo root.

## Acceptance criteria

- [x] `contracts/openapi.yaml` describes every auth endpoint, and the API matches it.
- [ ] A seeded user can sign in, reload the page and stay signed in, and sign out.
- [ ] An expired access token is refreshed automatically without the user noticing.
- [x] Reusing an old refresh token is rejected and revokes that user's sessions.
- [x] Two parallel 401s trigger exactly one refresh call.
- [x] Wrong password and unknown email return the same 401 response.
- [x] The sixth login attempt within a minute returns 429.
- [x] A viewer calling an editor-only endpoint gets 403; with no token, 401.
- [ ] No token is ever written to localStorage or sessionStorage.
- [x] A token signed by the API validates against `/.well-known/jwks.json`.
- [ ] Unauthenticated visits to any route redirect to `/login` and return afterwards.
- [ ] A remote rendered with a viewer `host` shows no edit or publish actions.
- [ ] Each criterion above has an automated test: Vitest and Supertest for the API, Vitest and React Testing Library for the frontend.

## Out of scope

- Public sign-up, email verification, password reset.
- Single sign-on (Google, OIDC providers) and multi-factor auth.
- User management UI and endpoints.
- Per-ruleset permissions or teams.
- Docker images for the API and deployment (separate deployment spec).

## Decisions (agreed 19 Nov 2026)

1. Seeded users only, no public sign-up.
2. Roles `VIEWER`, `EDITOR`, `ADMIN`; pinning the live version is admin-only.
3. One shared workspace; ruleset names unique across it.
4. RS256 with a JWKS endpoint.
5. The shell owns auth and passes each remote `{ user, can, api }`; the interceptor logic is a shared, stateless library.
6. React Router.
7. 15-minute access tokens, 7-day refresh tokens.
8. Backend in `apps/api` as an Nx app.
9. Prisma.
10. Validation derived from the contract (Zod), not hand-written DTO classes.
11. Contract-first: `contracts/openapi.yaml` written by hand.
12. Vitest everywhere, Supertest for API tests.
13. Argon2 for password hashing.

Versions of NestJS, Prisma and React Router are checked when planning.
