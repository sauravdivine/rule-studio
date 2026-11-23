# 003 · Rulesets API: build summary and learnings

**Spec:** [003-rulesets-api.md](003-rulesets-api.md) · **Plan:** [003-rulesets-api.plan.md](003-rulesets-api.plan.md)
**Status:** Built in one go (22 Nov 2026). All 12 acceptance criteria met, plus spec 001's last one.

## What was built, task by task

| Task                       | What                                                                                                                                                                                                                                                                       | Key files                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0 · Contract               | 12 endpoints in `openapi.yaml` with `ETag` / `If-Match` and every error response. `RulesetContent` added to `ruleset.schema.json` (same shape as before) and referenced from the OpenAPI file, so it is defined once. One generator now produces every type and Zod schema | `contracts/`, `scripts/generate-types.mjs`, `libs/shared-types` |
| 1 · Cross-field validation | `validateRulesetContent()` returns problems with JSON Pointer paths. It covers every rule in spec 001, plus "allowed values only on text fields" and "unique rule ids". Pure TypeScript, so the rule editor can use it unchanged                                           | `libs/ruleset-validation`                                       |
| 2 · Database               | `rulesets` (draft as jsonb, `revision`, `latestVersion`, `latestHash`, `liveVersion`, `archivedAt`) and `ruleset_versions` (composite key, append-only). Case-insensitive names through a lower-cased `nameKey` with a unique index                                        | `apps/api/prisma/schema.prisma`                                 |
| 3 · Content hash           | RFC 8785 canonical JSON, then SHA-256. The example's hash is pinned in a test                                                                                                                                                                                              | `apps/api/src/rulesets/content-hash.ts`                         |
| 4 · Read, create, edit     | List with filters and pages, create with a starter draft, get, rename, save draft. `@IfMatch()` decorator: `428` / `400` / `412`                                                                                                                                           | `apps/api/src/rulesets/`                                        |
| 5 · Publish and versions   | Publish in one transaction (`409` no changes, `422` problems), history, single version, pin (admin), restore, archive and unarchive                                                                                                                                        | `rulesets.service.ts`                                           |
| 6 · Seed                   | "Personal Loan Approval": v1 live (approval score 780), v2 published (750), and an unpublished change in the draft. Safe to run twice                                                                                                                                      | `apps/api/prisma/seed.ts`                                       |
| 7 · Docs                   | Backend conventions in `CLAUDE.md`, a Rulesets API section and five troubleshooting rows in `docs/commands.md`, specs 001 and 003 ticked                                                                                                                                   |                                                                 |

**Tests:** 21 in `libs/ruleset-validation` and 55 new in the API (114 API tests in total), against real Postgres. Lint, typecheck, tests and builds pass across the workspace.

**Checked against the running API** with curl:

- The seeded ruleset lists with `hasUnpublishedChanges: true`.
- `GET` sends `ETag: "6"`.
- Publishing with `If-Match: "5"` gets `412` with `currentRevision: 6`; with `"6"` it gets `201`, `Location: …/versions/3` and `ETag: "7"`.
- An editor pinning gets `403`. The admin's pin moves live to v3 and leaves the revision at 7.

## How a change flows

1. The client reads the ruleset and keeps its `ETag` (`"6"`).
2. It sends the change with `If-Match: "6"`. No header: `428`. Not an ETag: `400`.
3. In a transaction, the service loads the row: `404` if missing, `409` if archived, `412` if the revision isn't 6.
4. It writes with `UPDATE … WHERE id = … AND revision = 6`, bumping the revision. If another request got there first, zero rows match: `412`.
5. The response carries the new `ETag: "7"` for the next change.

Publishing adds two checks before the write (same hash as the latest version: `409`; cross-field problems: `422`) and inserts version `latest + 1`. If two publishes race, the version's primary key lets only one insert in, and the other gets `412`.

## Decisions and why

| Decision                                                                        | Why                                                                                             | Alternative considered                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ETag / If-Match, `412` and `428`                                                | Standard HTTP optimistic locking; `428` means no client can forget the check                    | Revision in the body and `409`                                                  |
| The lock is one conditional `UPDATE`                                            | Check-then-write can interleave with another request; one statement can't                       | `SELECT … FOR UPDATE` (pessimistic locking, holds a row lock)                   |
| Pin doesn't need `If-Match` or bump the revision                                | It doesn't touch the draft, so an editor saving at the same moment isn't interrupted by a `412` | Treat pin like any other change                                                 |
| `latestHash` kept on the ruleset row                                            | The list can show "unpublished changes" without reading the versions table                      | A join or subquery per row                                                      |
| `nameKey` column for case-insensitive names                                     | Portable, needs no raw SQL or Postgres extension                                                | `citext` column, or a unique index on `lower(name)` (Prisma can't declare that) |
| Draft structure validated with the contract's generated Zod (`zRulesetContent`) | Same path as every other request body; Zod is generated from the same JSON Schema               | Ajv against the JSON Schema file (the plan's choice; see below)                 |

## Changes from the plan

1. **One type generator instead of two.** The OpenAPI file now references `ruleset.schema.json`, so `@hey-api/openapi-ts` generates the ruleset types too. Keeping `json-schema-to-typescript` would have produced a second, clashing `Rule`, `Action` and so on. It's removed, and nothing imported its output.
2. **Zod instead of Ajv for the draft.** Using Ajv in the API would mean shipping the raw schema file inside the API build. The generated `zRulesetContent` carries the same rules, with one difference: unknown keys are dropped instead of refused, the same as every other request body. Ajv still validates the contracts in `npm run contracts:validate`.

Both are easy to reverse.

## Libraries added

| Library                       | What it solves                                                                                | Main alternative                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `canonicalize` 5.1.0 (pinned) | RFC 8785 canonical JSON, so equal content always hashes the same. By one of the RFC's authors | Hand-written "sort keys and stringify", which differs from the standard on number formatting |

Removed: `json-schema-to-typescript`.

## Problems found while building

- **Express adds its own `ETag` to every response**, a hash of the body, even on errors. A test client picked one up from a `400` and sent it back as `If-Match`, which looked like a bug in the lock. Express's ETags are now off (`app.disable('etag')`), so the only ETags are revisions. A test checks error responses have none.
- **The generated Zod drops `minProperties`**, so an empty `PATCH` was accepted. The rule is added next to its use in the controller, and `CLAUDE.md` now says to do this for any rule the generator drops.
- **The OpenAPI generator crashes on a `description` next to an external `$ref`** ("Cannot read properties of null"). The description became a YAML comment.
- **Allowed values on a non-text field were reported twice**: once on the field, and again on every condition using it. Allowed values now apply to text fields only.
- **The migration can't be generated in the AI's sandbox** (Prisma's schema engine can't be downloaded there). Tests there ran against a hand-written equivalent that stays in the sandbox; your Mac generates the real migration.

## Worth knowing for interviews

**Concurrency**

- **Optimistic vs pessimistic locking.** Optimistic: no locks; detect the conflict at write time and let the user retry. That suits editing where conflicts are rare and people work for minutes. Pessimistic (`SELECT … FOR UPDATE`, or a "checked out by Saurav" flag) blocks others, and locks get left behind when people close tabs.
- **Why the check and the write must be one statement.** "Read revision, compare, then update" lets two requests both pass the compare. `UPDATE … WHERE revision = 6` is atomic; the row count tells you whether you won.
- **ETag, If-Match, 412, 428.** An ETag identifies a version of a resource; `If-Match` makes a request conditional on it. `412` means the condition failed, and `428` means the server demands a condition. The same headers are used for caching (`If-None-Match` and `304`).
- **Two publishes at once:** the composite primary key `(ruleset_id, version)` is the last line of defence. The database refuses the second "version 3".

**Data and history**

- **Append-only history.** Published versions are never updated, so "what was live on 3 November" always has an answer. Rollback creates a new version with the old content (same hash) instead of rewriting history.
- **Change detection by hash.** Canonicalise first (RFC 8785), or `{"a":1,"b":2}` and `{"b":2,"a":1}` look different. Compare with the _latest_ version, not the live one, so publishing a rollback works.
- **jsonb for the rules.** The ruleset is read and written as one document and versioned as a whole, so one jsonb column fits. Normalised tables would need many joins to rebuild a version, for queries we don't run.
- **Case-insensitive uniqueness** needs the database's help (a unique index); checking in code first is a race.

**API design**

- **PUT vs PATCH.** `PUT /draft` replaces the whole document; `PATCH` changes named fields. Identity and content are separate because identity isn't versioned.
- **400 vs 409 vs 412 vs 422.** 400: malformed request. 409: conflicts with the resource's state. 412: your precondition failed. 422: well-formed but semantically invalid.
- **Offset pagination** is simple and shows totals. Cursor pagination is stable when rows are added mid-browse and fast at depth; switch when tables grow large.
- **Validation in two layers:** structure on every save (so stored data is always the right shape), business rules reported but not blocking until publish (so half-finished work can be saved). The rules are shared with the editor so both say the same thing.

## Commands introduced

`npx nx test ruleset-validation`, plus the Rulesets API curl examples in `docs/commands.md`.

## Next

Spec 005, the rule editor: the first screens on top of this API (ruleset list, draft editor using `libs/ruleset-validation`, publish dialog, history and pinning).
