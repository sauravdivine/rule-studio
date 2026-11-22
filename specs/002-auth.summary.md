# 002 · Auth: build summary and learnings

**Spec:** [002-auth.md](002-auth.md) · **Plan:** [002-auth.plan.md](002-auth.plan.md)
**Status:** Tasks 0–7 built 19–22 Nov 2026; tasks 8–9 built 22 Nov 2026 (section at the end). All 13 acceptance criteria met. Task 10 (the end-to-end check on the owner's Mac) remains.

What was built, why, which libraries came in, and what is worth being able to explain in an interview.

## What was built, task by task

| Task                  | What                                                                                                                                                                                                  | Key files                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0 · Housekeeping      | Switched the backend from Spring Boot to NestJS in the docs and layout; removed `backend/`                                                                                                            | `CLAUDE.md`, `README.md`                                                            |
| 1 · API contract      | Hand-written OpenAPI 3.1 contract for the five auth endpoints; TypeScript types **and** Zod validators generated from it; the contract is validated in `contracts:validate`                           | `contracts/openapi.yaml`, `scripts/generate-types.mjs`, `libs/shared-types`         |
| 2 · Permissions       | Role → permission map and `can()`, shared by the API and the UI; 31 tests, including one that fails if the contract gains a permission nobody is granted                                              | `libs/permissions`                                                                  |
| 3 · API skeleton      | Nest app; environment validated with Zod at startup; one exception filter that turns every error into RFC 9457 problem details; a Zod validation pipe; Postgres in Docker; Vite proxy for same-origin | `apps/api/src/common`, `docker-compose.yml`, `apps/shell/vite.config.mts`           |
| 4 · Database          | Prisma 7 schema (`users`, `refresh_tokens`), migrations, seed for three demo users, Nx targets wrapping Prisma                                                                                        | `apps/api/prisma`, `apps/api/src/prisma`, `apps/api/project.json`                   |
| 5 · Tokens and guards | RS256 access tokens with a key id, JWKS endpoint, key-generation script; a global JWT guard (401) and a global permissions guard (403)                                                                | `apps/api/src/auth/token.service.ts`, `auth/guards`, `scripts/generate-jwt-key.mjs` |
| 6 · Auth endpoints    | Login (rate-limited per IP and per email), refresh with rotation and reuse detection, logout, me                                                                                                      | `apps/api/src/auth/auth.service.ts`, `auth.controller.ts`                           |
| 7 · API client        | Stateless `createApiClient()`: adds the token, refreshes once on 401 (one refresh shared by parallel requests), retries once, signs out if that fails                                                 | `libs/api-client`                                                                   |

**Tests:** 104 across the workspace. The API's 59 include 24 HTTP tests (Supertest) that run the real app against a fresh Postgres test database built from the migrations.

**Acceptance criteria:** 7 of 13 met by tasks 0–7; the frontend six were met in tasks 8–9 (see the end of this file).

## How a request flows

1. **Login:** `POST /api/auth/login` → throttler (5/min per IP and per email) → Zod pipe checks the body against the contract → `AuthService` verifies the Argon2 hash → issues a 15-minute JWT (in the body) and a 7-day refresh token (in an `HttpOnly` cookie; only its SHA-256 hash is stored).
2. **Any API call:** `Authorization: Bearer <jwt>` → `JwtAuthGuard` verifies signature, algorithm, issuer, audience and expiry (401 if not) → `PermissionsGuard` checks `@RequirePermission` against `libs/permissions` (403 if not) → controller.
3. **Access token expired:** the API answers 401 → `api-client` calls the shell's `refresh` once (shared by all waiting requests) → `POST /api/auth/refresh` with the cookie → the old refresh token is marked used and a new one issued → the original request is retried.
4. **Any error,** anywhere: the exception filter turns it into `application/problem+json`; unexpected errors become a generic 500 and are only logged on the server.

## Decisions and why

| Decision                                                      | Why                                                                                                                 | Alternative considered                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| NestJS instead of Spring Boot                                 | One language end to end; types, validation and permissions shared between browser and server                        | Spring Boot (the original plan)                   |
| NestJS 11, not 12                                             | Nx 24's Nest generator only supports up to 11                                                                       | NestJS 12 without the generator                   |
| Contract-first OpenAPI                                        | The contract is the single source of truth; types and validators are generated, so the API and frontend can't drift | Code-first (`@nestjs/swagger` generates the spec) |
| Zod from the contract, not `class-validator` DTOs             | No second, hand-written copy of the rules                                                                           | `class-validator` (Nest's usual default)          |
| RS256 + JWKS                                                  | Other services can verify tokens with the public key, without a shared secret                                       | HS256 with a shared secret                        |
| Access token in memory, refresh token in an `HttpOnly` cookie | JavaScript (and so XSS) can't read the refresh token; the access token never touches storage                        | Both tokens in localStorage                       |
| Refresh token rotation with reuse detection                   | A stolen refresh token is detected the moment it or the real one is reused                                          | Long-lived, reusable refresh tokens               |
| Permissions, not role checks                                  | UI and API use one map; roles can change without touching features                                                  | `if (role === 'ADMIN')` scattered in code         |
| Shell owns auth; remotes get `{ user, can, api }`             | Module Federation can silently duplicate a shared store or context; share capabilities, not state                   | A shared auth store as a federation singleton     |
| Same origin via proxy                                         | Keeps the refresh cookie first-party; no CORS needed                                                                | Cross-site cookies and CORS                       |
| Postgres with Prisma 7                                        | Strong types, migrations and seeding; Postgres gives uniqueness, transactions and JSONB for rulesets later          | Drizzle, TypeORM                                  |
| Argon2id for passwords                                        | OWASP's first choice; slow by design                                                                                | bcrypt                                            |
| Real Postgres in tests                                        | Tests exercise the actual SQL and constraints                                                                       | Mocking the database                              |

## Libraries added

| Library                                 | What it solves                                                          | Main alternative                                       |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| `@hey-api/openapi-ts`                   | Generates TypeScript types and Zod schemas from `openapi.yaml`          | `openapi-typescript` + a separate Zod generator, Orval |
| `@apidevtools/swagger-parser`           | Validates the OpenAPI file and resolves every `$ref`                    | Redocly CLI                                            |
| `zod`                                   | Runtime validation of request bodies and environment variables          | `class-validator`, Ajv                                 |
| NestJS 11 (`@nestjs/*`, via `@nx/nest`) | API framework: modules, dependency injection, guards, pipes, filters    | Express alone, Fastify                                 |
| `supertest`                             | Calls the app over HTTP in tests                                        | Starting a server and using `fetch`                    |
| Prisma 7 + `@prisma/adapter-pg`         | Typed queries and migrations; Prisma 7 connects through the `pg` driver | Drizzle, TypeORM                                       |
| `argon2`                                | Password hashing                                                        | bcrypt                                                 |
| `jose`                                  | Signs and verifies JWTs; exports the public key as a JWK                | `jsonwebtoken`                                         |
| `@nestjs/throttler`                     | Rate limiting, with a separate counter per IP and per email             | `express-rate-limit`                                   |
| `cookie-parser`                         | Reads the refresh cookie into `request.cookies`                         | Parsing the header by hand                             |
| `tsx` (dev)                             | Runs the TypeScript seed script                                         | `ts-node`                                              |
| `pg` (dev)                              | Lets the test setup create and drop the test database                   | —                                                      |

## Problems found while building

These are the real "the AI or the tooling got it wrong, and it was caught" moments.

- **Admins silently lost three permissions** (Task 2). A placeholder comment from the outline was pasted in as-is, so `ADMIN` had only the editor's permissions. The code compiled and ran; the tests caught it with six failures that named the missing permissions.
- **A `204` response with a body** (Task 1). The OpenAPI validator passed it because it only checks that the file is well-formed, not that it makes sense. Caught in review. Lesson: validators check structure, people check meaning.
- **Lint advice that was wrong** (Task 3). An underscore prefix was suggested to silence unused-variable warnings, but this repo's lint rules don't honour it. Rewritten so there are no unused variables.
- **A race in Nx's generated config** (Task 4). The typecheck wrote its output into `dist`, the folder webpack empties at the start of each build, so a parallel `run-many` failed at random. The typecheck now writes to `out-tsc/app`.
- **Generated files committed by accident.** The shell's `@mf-types` folder is regenerated by every build; it was committed and caused lint warnings. Now ignored by Git and lint.
- **Seed failed on a fresh checkout** (Task 4, found on the owner's Mac). Prisma 7's `migrate dev` no longer generates the client, and `db-seed` didn't depend on `prisma-generate`, so it couldn't find `src/generated/prisma/client`. It passed in the AI's workspace only because the client already existed there. Fixed by adding the dependency. Lesson: test from a clean checkout.
- **The throttler names its header per limit** (`Retry-After-login-email`), but the contract promises a plain `Retry-After`. A small guard subclass sets the contract's header.

## Worth knowing for interviews

**Security**

- **Why a refresh token gets a fast hash (SHA-256) but a password gets a slow one (Argon2).** Passwords are low-entropy, so hashing has to be slow to resist guessing. A refresh token is 32 random bytes, so it can't be guessed; a fast hash is enough. Either way, a database leak gives nothing usable.
- **Rotation plus reuse detection.** Each refresh token works once. If a used one comes back, someone holds a copy, so every session for that user is revoked: a stolen token turns into "everyone signs in again", not a silent takeover.
- **Timing attacks on login.** An unknown email still runs an Argon2 check against a dummy hash, so response time can't reveal which emails have accounts. The error message is identical too.
- **JWT hardening.** Only RS256 is accepted, which blocks `alg: none` and forged symmetric-key tokens. Issuer, audience and expiry are checked, and the role claim is validated against the contract.
- **401 vs 403.** 401 means "who are you?" (not signed in); 403 means "I know who you are, and you're not allowed". The two guards run in that order.
- **Cookie flags.** `HttpOnly`: JavaScript can't read it. `Secure`: HTTPS only (browsers allow localhost). `SameSite=Strict`: never sent from another site, which blocks CSRF. `Path=/api/auth`: sent only where it's needed.
- **Why logout always returns 204.** The user always ends up signed out, and the response reveals nothing about whether a token was valid.
- **Never leaking internals.** Unexpected errors become a generic 500; the real error is logged on the server only. Config errors name the variable but never print its value.

**Concurrency**

- **Server side:** marking a refresh token used with `UPDATE … WHERE used_at IS NULL` is atomic, so two simultaneous refreshes can't both succeed. A test fires two at once to prove it.
- **Client side:** single-flight refresh. All requests that get a 401 at the same time share one refresh, because two parallel refreshes would look like token reuse and revoke the session.

**Architecture**

- **Contract-first.** One hand-written contract; types and runtime validators generated from it; the API, the frontend and validation can't disagree.
- **Micro frontends and auth.** The shell owns auth state; remotes receive `{ user, can, api }`. A shared store or React context risks being duplicated by Module Federation. Share capabilities, not state.
- **Nest building blocks** (each is a common interview question): _modules_ group features; _dependency injection_ supplies config and services (`@Inject(APP_CONFIG)`); _guards_ decide whether a request may continue; _pipes_ validate and transform input; _exception filters_ turn errors into responses.
- **Fail fast on config.** The environment is validated at startup, so a missing secret stops the app immediately instead of failing on the first request.
- **Storage as a module, not a service.** Platforms with many teams often put storage behind a separate service (an asset store). Here it's a module inside one API, because one owner and one asset type don't justify the extra network hop yet.

**Testing**

- **Tests that catch what compiles:** the admin-permissions bug above.
- **Testing against a real database:** each run creates `rulestudio_test`, applies the real migrations, and truncates tables between tests. No mocks, so SQL and constraints are tested too.
- **Testing a filter without a server:** a fake `ArgumentsHost` with a fake response, so the exception filter's logic is unit-tested on its own.

## Commands introduced

All listed, with what they do, in [`docs/commands.md`](../docs/commands.md): `npm run contracts:validate`, `npm run contracts:types`, `npm run jwt:keys`, `npx nx run api:prisma-generate`, `api:db-migrate`, `api:db-deploy`, `api:db-seed`, `api:db-studio`, and `docker compose up -d`, `ps`, `down`.

## Tasks 8–9: sign-in in the shell, routing and the host prop (22 Nov 2026)

Built in one go after spec 004, using its components.

### What was built

| Task           | What                                                                                                                                                                                                                                                         | Key files                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 8 · Auth state | An auth session in plain TypeScript, with no React inside: the access token in a closure variable, the user, one shared refresh, login and logout. React reads it through `useSyncExternalStore`. It starts once in `bootstrap.tsx`, before the first render | `apps/shell/src/auth/session.ts`, `auth-context.tsx`                          |
| 8 · Routing    | React Router: `/login`, `/rulesets`, `/simulator`, `/dashboard`, a 404 page. Signed-out visits go to `/login?returnTo=…` and come back after sign-in. A loading screen shows until the first refresh answers                                                 | `apps/shell/src/App.tsx`, `pages/require-auth.tsx`, `navigation.ts`           |
| 8 · Login page | Email and password with React Hook Form, validated by the **same Zod schema the API uses** (`zLoginRequest`, generated from the contract). Inline errors, an error alert, a busy button and three demo sign-in buttons                                       | `pages/login-page.tsx`                                                        |
| 8 · Layout     | Navigation filtered by `can()`, a user menu with role badge and sign out, the theme toggle                                                                                                                                                                   | `pages/shell-layout.tsx`                                                      |
| 9 · Host prop  | `libs/host`: the `Host` / `HostProps` types and `createTestHost(role)` for tests and standalone runs. The shell passes `host` to each remote. The rule editor shows Edit and Publish only when `can()` allows                                                | `libs/host`, `apps/shell/src/remote-slot.tsx`, `apps/rule-editor/src/App.tsx` |

**Tests:** 46 new. That is 39 in the shell (session, routing, login, layout, navigation, an axe scan of the login page), 3 in the rule editor (viewer/editor/admin) 3 in `libs/host`, and 1 in `libs/ui` for `CardTitle`'s heading level. The shell runs against a fake auth API that behaves like the real one: rotating refresh cookie, problem details, Bearer checks.

**Checked in a real browser against the real API and Postgres** (Playwright, access token shortened to 60 seconds):

- Visiting `/simulator` signed out → `/login?returnTo=%2Fsimulator` → the demo viewer button signs in and returns to `/simulator`.
- A wrong password gives "Invalid email or password."
- The viewer sees no Edit or Publish and a "Read only" badge. The editor sees Create, Edit and Publish.
- JavaScript sees nothing in `localStorage`, `sessionStorage` or `document.cookie` (the refresh cookie is `HttpOnly`).
- A reload keeps you signed in, including after the access token expired.
- Sign out, then reload: still signed out, because the refresh token was revoked on the server.
- No page errors.

Not checked in the browser: the 401 → refresh → retry path, because no remote calls the API yet. It is covered by the session tests against the fake API and by `libs/api-client`'s tests, and will run for real once spec 003 adds endpoints the remotes call.

### Decisions and why

| Decision                                                                      | Why                                                                                                                                                                                               | Alternative considered                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Session as a plain TS module with `subscribe`/`getState`                      | The tricky logic (single-flight refresh, sign-out) is tested without rendering; React only reads it                                                                                               | Auth logic inside a React context provider with `useState`/`useEffect`                |
| Start the session in `bootstrap.tsx`, not in a `useEffect`                    | StrictMode runs effects twice in development. Two refreshes with the same rotating token look like theft, and the API revokes every session. The session is also single-flight, as a second guard | `useEffect(() => refresh(), [])`                                                      |
| Loading screen until the first refresh answers                                | Otherwise a signed-in user sees the login page flash on every reload                                                                                                                              | Render routes at once                                                                 |
| `returnTo` in the URL, checked by `safeReturnPath()`                          | Survives a reload of the login page. Only in-app paths are accepted, so a crafted link can't redirect to another site (open redirect)                                                             | Router `state` (lost on reload)                                                       |
| Login validated with the contract's Zod schema                                | One set of rules for the browser and the API                                                                                                                                                      | Hand-written checks in the form                                                       |
| Demo password read from `SEED_DEMO_PASSWORD` in the root `.env` at build time | One value for the seed and the buttons. It is public by design, so being in the bundle is fine                                                                                                    | A `demo-login` API endpoint (a contract change), or a second variable to keep in sync |
| `createTestHost` in a `/testing` subpath                                      | Tests and standalone remotes get real permission rules; app bundles don't include test helpers                                                                                                    | A mock per test file                                                                  |

### Libraries added

| Library                              | What it solves                                                                                                      | Main alternative                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `react-router` 8.5.1 (pinned)        | Routes, redirects, `NavLink` active state. The declarative API (`Routes`, `Route`, `Navigate`) is unchanged from v7 | TanStack Router                      |
| `react-hook-form` 7.91.0 (pinned)    | Form state and validation without re-rendering on every keystroke                                                   | Formik, plain `useState`             |
| `@hookform/resolvers` 5.9.2 (pinned) | Connects a Zod schema to React Hook Form                                                                            | Validating by hand in `handleSubmit` |

Versions are pinned exactly and are at least two weeks old. React Router 8.5.2 and `@hookform/resolvers` 7.x were days old; the resolvers package shipped two major versions in October and November.

### Problems found while building

- **Navigating between sections kept showing the first remote.** Each route rendered a `RemoteSlot` in the same place with the same key (the user id), so React reused the instance, and the slot kept the remote it loaded first. The URL said `/rulesets` while the simulator stayed on screen. Unit tests missed it because no test moved between sections; the browser run caught it. Fixed by keying the slot by remote and user. A new test fails without the fix and passes with it.
- **A heading inside a heading.** The login card put an `<h1>` inside `CardTitle`, which is an `<h3>`. A test failed on the duplicate heading. Fixed by giving `CardTitle` an `as` prop for the heading level (in `libs/ui`, with a test).
- **npm widened the chosen versions** to the newest releases when installing. Fixed by pinning exact versions in `apps/shell/package.json`.
- **First load of a remote in dev reloads the page once** while Vite bundles its dependencies. Harmless, dev only, but it can make a quick test look like it failed.

### Worth knowing for interviews

- **"Where is the access token stored?"** In a closure variable inside the shell's session module. It isn't on `window`, in React state that devtools can browse, or in storage. A reload loses it on purpose; the `HttpOnly` refresh cookie gets a new one.
- **"What does StrictMode have to do with auth?"** Double-invoked effects plus rotating refresh tokens equals a revoked session in development. Start side effects outside React or make them idempotent.
- **"How do micro frontends get auth?"** Through one prop, `host = { user, can, api }`. Remotes can't see tokens, and testing a remote is just rendering it with `createTestHost('VIEWER')`.
- **"How do you stop the login page flashing?"** A loading state until the first refresh resolves.
- **"What is an open redirect?"** A `?returnTo=https://evil.example` that sends users off-site after a trusted login page. `safeReturnPath()` accepts only in-app paths.
- **React keys aren't just for lists.** Same component type, same position, same key means React keeps the instance and its state. Change the key to get a fresh one.
