# 002 · Auth: implementation plan

**Spec:** [002-auth.md](002-auth.md) (approved)
**Status:** Approved (19 Nov 2026). Tasks 0–7 done (22 Nov 2026); tasks 8–9 wait for spec 004.

Each task is one reviewable step. After each: checks pass, the owner reviews, then commits. No task starts before the previous one is reviewed.

## Versions (checked 19 Nov 2026)

| Package                                                                                            | Use                                                                | Why                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| NestJS **11.2.x**                                                                                  | API framework, on Express                                          | NestJS 12 is out, but Nx 24's `@nx/nest` generator only supports up to 11                  |
| Prisma **7.10.x**                                                                                  | ORM, migrations, seed                                              | npm's `latest` tag currently points at an 8.0 release candidate; 7.10 is the newest stable |
| Nx **24.0.4**                                                                                      | Workspace                                                          | Match the existing workspace; `@nx/nest` pinned to the same version                        |
| React Router **8.5.x**                                                                             | Shell routing                                                      | Latest stable                                                                              |
| Zod **4.x**, jose **6.x**, argon2, `@nestjs/throttler` **6.x**, `cookie-parser`, Supertest **7.x** | As in the spec                                                     | Latest stable                                                                              |
| `@hey-api/openapi-ts`                                                                              | Generates TypeScript types **and** Zod schemas from `openapi.yaml` | One tool for both, so validation and types come from the same contract                     |

## Who does what

Updated 21 Nov 2026: from Task 4, the AI builds the remaining tasks in one go and then summarises them (see "How we work" in `CLAUDE.md`). The owner runs the commands the AI cannot run on the Mac (installs, Docker, migrations) and commits.

## Sequencing (decided 20 Nov 2026)

Tasks 0–7 (contract, permissions, API, database, tokens, auth endpoints, API client) are built first. Then spec 002 **pauses**, and spec 004 (UI foundation: design tokens and components) is specced and built. Tasks 8 and 9 (login page, routing, host prop) resume afterwards, so the first screen is built with real `libs/ui` components and tokens instead of being restyled later.

## Tasks

### 0. Housekeeping

- Update `CLAUDE.md`: NestJS backend conventions, `apps/api` in the layout, new commands.
- Update `README.md` stack and structure.
- Remove `backend/`.
- **Done when:** no file mentions Spring Boot, Maven or Java.

### 1. API contract and code generation

- Write `contracts/openapi.yaml`: the five auth endpoints, `User`, `AuthResponse`, and the problem-details error shape.
- Add `@hey-api/openapi-ts`; extend `npm run contracts:types` to generate API types and Zod schemas into `libs/shared-types/src/generated/api/`.
- Extend `npm run contracts:validate` to check the OpenAPI file is valid.
- **Done when:** both scripts pass and the workspace typechecks.

### 2. `libs/permissions`

- Permission names, the role-to-permission map, and `can(role, permission)`.
- **Done when:** unit tests cover every role against every permission.

### 3. API skeleton

- Generate `apps/api` with `@nx/nest` (Express).
- Config module that validates environment variables with Zod at startup (the app refuses to start with a missing secret).
- Global problem-details exception filter and a Zod validation pipe (written in the app, about 20 lines, rather than another dependency).
- `docker-compose.yml` with Postgres; `.env.example`.
- Vite proxy in the shell for `/api` and `/.well-known` to `:3000`.
- **Done when:** `nx serve api` starts, an unknown route returns a problem-details 404, and tests pass.

### 4. Database

- Prisma schema for `User` and `RefreshToken`, first migration.
- Seed script for the three demo users, passwords hashed with Argon2, from environment variables.
- **Done when:** migrate and seed run cleanly on the owner's Mac, and a test can read a seeded user.

### 5. Tokens and guards

- Script that generates a local RS256 key pair into `.env`.
- Token service using `jose`: sign access tokens with a `kid`, verify them, serve `/.well-known/jwks.json`.
- Global JWT guard (with a `@Public()` decorator for the open endpoints) and a permissions guard with `@RequirePermission(...)`, using `libs/permissions`.
- **Done when:** tests show a signed token verifies against JWKS, no token gives 401, and a missing permission gives 403.

### 6. Auth endpoints

- `login`: Argon2 verify; unknown emails checked against a dummy hash so timing matches; rate-limited per IP and per email.
- `refresh`: rotation, and reuse of a used token revokes all the user's sessions.
- `logout` and `me`.
- Refresh cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, path `/api/auth`.
- **Done when:** Supertest covers every backend acceptance criterion in the spec.

### 7. `libs/api-client`

- Stateless `createApiClient({ getAccessToken, refresh, onSignedOut })`: adds the header, retries once after a 401, signs out if refresh fails.
- **Done when:** tests prove two parallel 401s cause exactly one refresh, and a failed refresh calls `onSignedOut`.

### 8. Shell: auth state, routing, login (after spec 004)

- Auth state in the shell: in-memory token, user, single in-flight refresh, bootstrap refresh on load with a loading screen.
- React Router: `/login`, `/rulesets`, `/simulator`, `/dashboard`; protected routes redirect to `/login` and return afterwards.
- Login page with three demo sign-in buttons; navigation filtered by `can(...)`.
- **Done when:** tests cover redirect-and-return, login errors, and that no token reaches localStorage or sessionStorage.

### 9. Host prop to remotes (after spec 004)

- `HostProps` type (`user`, `can`, `api`) in a small shared library, `libs/host`.
- Shell passes `host` to each remote; each remote accepts it.
- Rule editor placeholder shows Edit and Publish only when `can(...)` allows.
- **Done when:** a test renders the rule editor with a viewer host and finds no edit or publish actions.

### 10. End-to-end check

- On the owner's Mac: Postgres up, migrate, seed, serve everything; sign in as each demo user; check refresh by waiting out a short access-token lifetime.
- Tick the spec's acceptance criteria; mark spec 002 Done in `CLAUDE.md`.

## Decisions (confirmed 19 Nov 2026)

1. NestJS 11 instead of 12, because Nx 24's Nest generator only supports up to 11.
2. Prisma 7.10 stable, not the 8.0 release candidate.
3. `@hey-api/openapi-ts` for types and Zod from the contract.
4. A small hand-written Zod validation pipe instead of the `nestjs-zod` package.
5. Host types in a new `libs/host` library.
