# 003 · Rulesets API: implementation plan

**Spec:** [003-rulesets-api.md](003-rulesets-api.md) (approved 22 Nov 2026)
**Status:** Approved and built (22 Nov 2026). What was built: [003-rulesets-api.summary.md](003-rulesets-api.summary.md)

Built in one go once approved (see "How we work" in `CLAUDE.md`), then summarised in `003-rulesets-api.summary.md`. The owner runs the commands the AI can't run on the Mac (install, migration, seed) and commits.

## Versions (checked 22 Nov 2026)

| Package                                                                 | Use                                                     | Why                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `canonicalize` **5.1.x** (new)                                          | RFC 8785 canonical JSON before hashing                  | By one of the RFC's authors; latest release is two months old |
| Ajv **8.20.x** (already in the repo, moves into the API's dependencies) | Checks a draft against `ruleset.schema.json` at runtime | Already validates the contracts; same engine, same results    |
| Prisma 7.10, NestJS 11, Zod 4, `@hey-api/openapi-ts`                    | As in spec 002                                          | No changes                                                    |

No other new libraries.

## Tasks

Each task lists the interview questions it prepares you for.

### 0. Contract first

- `ruleset.schema.json`: add `$defs/RulesetContent` (the versioned part: `schemaVersion`, `inputFields`, `hitStrategy`, `defaultAction`, `rules`). The root keeps exactly the same shape; spec 001's tests must still pass.
- `openapi.yaml`: the 12 endpoints, request and response schemas, `ETag` / `If-Match` headers, and the `400`, `403`, `404`, `409`, `412`, `422`, `428` responses. The draft schema points at `ruleset.schema.json#/$defs/RulesetContent` so there is one definition.
- Regenerate types and Zod (`npm run contracts:types`), and run `npm run contracts:validate`.
- **Risk to check first:** whether `@hey-api/openapi-ts` follows a reference into another file. If it doesn't, the OpenAPI file describes the draft as a plain object and the API checks it with Ajv against the JSON Schema (still one source).
- **Done when:** the contract validates, types generate, and the workspace typechecks.
- _Interview:_ "What is contract-first, and what do you gain?" · "How do you keep a JSON Schema and an OpenAPI file from drifting?"

### 1. `libs/ruleset-validation`

- New library: `validateRulesetContent(content) → Problem[]`, each problem with a JSON Pointer `path` and a message.
- The cross-field rules from spec 001: unknown field, operator not allowed for the type, value of the wrong type, `BETWEEN` min > max, duplicate priorities, duplicate keys, value outside `allowedValues`.
- One passing example (spec 001's loan approval) and one failing example per rule. That ticks spec 001's last acceptance criterion.
- Pure TypeScript with no Node or browser APIs, so the rule editor (005) can import it unchanged.
- **Done when:** every rule has a failing example and the example ruleset has no problems.
- _Interview:_ "Where should validation live in a full-stack app?" · "Why share validation code between client and server, and what still must be checked on the server?"

### 2. Database

- Prisma models `Ruleset` and `RulesetVersion` as in the spec. Case-insensitive uniqueness: a `nameKey` column (the name lower-cased) with a unique index, set by the service. That's portable and needs no raw SQL. The alternative is Postgres `citext`.
- `RulesetVersion` has a composite primary key (`rulesetId`, `version`); the service never updates or deletes it.
- Migration created on the Mac with `db-migrate` (the sandbox can't run Prisma's schema engine).
- **Done when:** the migration applies cleanly and the API tests' database setup picks it up.
- _Interview:_ "Why a composite key here?" · "How do you enforce case-insensitive uniqueness?" · "jsonb vs normalised tables for rules: what do you trade?"

### 3. Content hash

- `contentHash(content)`: `canonicalize` then SHA-256 (hex).
- Tests: the same content with keys in a different order gives the same hash; any real change gives a different one; the hash of spec 001's example is pinned so an accidental change to hashing is caught.
- **Done when:** the tests pass.
- _Interview:_ "Why canonicalise before hashing?" · "What is RFC 8785?" · "Hash vs deep compare for change detection?"

### 4. Rulesets: read, create, edit

- `RulesetsModule`: list (filters, pagination, `total`), create (starter draft), get (with `validation`), `PATCH` identity, `PUT` draft.
- Optimistic locking: a small `@IfMatch()` parameter decorator reads and parses the header (`428` when missing on a change, `400` when malformed); the update is `updateMany where id and revision`, and `count === 0` becomes `412` with the current revision. Responses set `ETag`.
- Draft save: Ajv structure check (`400` with the errors), then the cross-field problems from task 1 (returned, not blocking), then `draftHash` and `revision + 1`.
- Archived rulesets: every change answers `409`.
- Permissions on every route with `@RequirePermission`.
- **Done when:** tests against real Postgres cover each endpoint, `403`s by role, `412`, `428`, `400` vs saved-with-problems, unique names ignoring case, and pagination.
- _Interview:_ "Optimistic vs pessimistic locking?" · "What are ETag and If-Match, and why 412 and 428?" · "PUT vs PATCH?" · "How do you paginate, and when would you switch to cursors?"

### 5. Publishing, versions, live and archive

- Publish in one transaction: check the revision, `409` when nothing changed, `422` with problems when invalid, insert version `latestVersion + 1`, update `latestVersion`, `liveVersion` (first publish, or `makeLive`) and `revision`.
- Version list (with `isLive`) and single version with content.
- `PUT /live` (admin; `409` when nothing is published; `404` for an unknown version).
- Restore: copy a version's content into the draft (`If-Match`, recompute hash and problems).
- Archive and unarchive (admin, `If-Match`), plus the `status` filter on the list.
- **Done when:** tests cover the publish rules, the live-version rules, rollback creating v3 with v1's hash, versions never changing after later saves and publishes, two publishes at once (one wins, one `412`), and archive behaviour.
- _Interview:_ "How do you make history immutable?" · "Why does rollback create a new version instead of moving a pointer back?" · "What happens if two people publish at the same moment?" · "What does a transaction guarantee here?"

### 6. Seed

- Add the loan approval ruleset: v1 published and live, v2 published (a changed threshold), and an unpublished change in the draft. Running the seed twice changes nothing.
- **Done when:** a fresh database seeds, and a viewer can list the ruleset and see two versions.

### 7. Docs and checks

- `docs/commands.md`: a "Rulesets API" section with curl examples showing the `ETag` → `If-Match` round trip, a `412`, a publish and a pin. Troubleshooting rows for `412` and `428`.
- `CLAUDE.md`: backend conventions (optimistic locking on every change endpoint; versions are append-only), spec table.
- Spec 003 criteria ticked; `003-rulesets-api.summary.md` written.
- Full check across the workspace, including the API tests against real Postgres.

## What the owner runs afterwards

1. `npm install`: adds `canonicalize`.
2. `npx nx run api:db-migrate --name rulesets`: creates and applies the migration.
3. `npx nx run api:db-seed`: adds the example ruleset.
4. The checks, then commit.

## Not in this plan

- Any UI. The rule editor screens use these endpoints in spec 005.
- Evaluating a ruleset (006) and simulator endpoints (007).
