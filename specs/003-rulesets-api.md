# 003 · Rulesets API

**Status:** Built (22 Nov 2026). Plan: [003-rulesets-api.plan.md](003-rulesets-api.plan.md) · Summary: [003-rulesets-api.summary.md](003-rulesets-api.summary.md)
**Depends on:** [001 · Ruleset data model](001-ruleset-data-model.md), [002 · Auth](002-auth.md)
**Contract:** `contracts/openapi.yaml` (the endpoints below are added to it first, then built)

## Goal

Store rulesets, let people edit a draft safely, publish immutable versions, and choose which version is live. This is the backend every later spec reads from: the rule editor (005), the engine (006), the simulator (007), the dashboard (008) and the AI features (009, 010).

API only. The screens that use it come in spec 005.

## User stories

- As an editor, I create a ruleset and edit its draft as often as I like without affecting anything that is published.
- As an editor, I see whether my draft has unpublished changes and whether it is valid, with every problem listed.
- As an editor, I publish the draft as a new version with an optional comment, and can't publish an invalid draft or one with no changes.
- As an editor, if someone else saved the draft after I opened it, my save is refused instead of silently overwriting their work.
- As an admin, I choose which published version is live, and I can archive a ruleset that is no longer used.
- As anyone signed in, I browse rulesets, their version history, and the exact content of any version.
- As an editor, I roll back by restoring an old version into the draft and publishing it again.

## Concepts (decided earlier, kept here)

- **Draft:** one working copy per ruleset. Saving never creates a version. The draft may be invalid while being edited (see Validation).
- **Version:** a frozen copy of the draft's versioned content, numbered 1, 2, 3… per ruleset. Never edited or deleted.
- **Live version:** the one published version that counts as "in use". The first publish makes v1 live; later publishes move it only when asked ("Make this version live"). Admins can pin any version at any time.
- **Identity** (`name`, `description`) is not versioned: changes take effect at once.
- **No changes, no publish:** the server keeps a SHA-256 `contentHash` of the draft's versioned content, computed on canonical JSON (RFC 8785). `hasUnpublishedChanges` compares it with the **latest** version's hash.
- **Rollback** copies an old version into the draft; publishing it makes a new version. History is never rewritten.

## Endpoints

All under `/api`, all need a signed-in user. **Permission** is checked by the guard from spec 002.

| Method and path                                  | Permission        | What it does                                                                                                                                                           |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /rulesets`                                  | `ruleset:read`    | List rulesets (summary only, no rules). Filters: `status=active\|archived` (default `active`), `q` (name contains). Sorted by last update, newest first. Paginated     |
| `POST /rulesets`                                 | `ruleset:edit`    | Create a ruleset from `name` and optional `description`. Starts with a starter draft (see below). `201` with `Location`                                                |
| `GET /rulesets/{id}`                             | `ruleset:read`    | The ruleset: identity, the full draft, validation result, status fields, `ETag`                                                                                        |
| `PATCH /rulesets/{id}`                           | `ruleset:edit`    | Change `name` and/or `description`. Needs `If-Match`                                                                                                                   |
| `PUT /rulesets/{id}/draft`                       | `ruleset:edit`    | Replace the draft's versioned content. Needs `If-Match`. Returns the updated ruleset                                                                                   |
| `GET /rulesets/{id}/versions`                    | `ruleset:read`    | Version history, newest first: number, comment, who, when, hash, whether live. No content                                                                              |
| `GET /rulesets/{id}/versions/{version}`          | `ruleset:read`    | One version with its frozen content                                                                                                                                    |
| `POST /rulesets/{id}/versions`                   | `ruleset:publish` | Publish the draft. Body: `comment` (optional, ≤ 500), `makeLive` (boolean, default false; `true` also needs `ruleset:pin`, added in spec 005). Needs `If-Match`. `201` |
| `PUT /rulesets/{id}/live`                        | `ruleset:pin`     | Make a published version live. Body: `version`                                                                                                                         |
| `POST /rulesets/{id}/versions/{version}/restore` | `ruleset:edit`    | Copy that version's content into the draft (rollback, step 1). Needs `If-Match`                                                                                        |
| `POST /rulesets/{id}/archive`                    | `ruleset:archive` | Archive. Needs `If-Match`                                                                                                                                              |
| `POST /rulesets/{id}/unarchive`                  | `ruleset:archive` | Unarchive. Needs `If-Match`                                                                                                                                            |

There is no delete: published versions are history, and archive replaces delete.

### What `GET /rulesets/{id}` returns

```json
{
  "id": "…",
  "name": "Loan approval",
  "description": "…",
  "draft": {
    "schemaVersion": 1,
    "inputFields": [],
    "hitStrategy": "FIRST",
    "defaultAction": {},
    "rules": []
  },
  "validation": {
    "valid": false,
    "problems": [
      {
        "path": "/rules/2/when/children/0/field",
        "message": "Unknown field \"income\""
      }
    ]
  },
  "revision": 14,
  "hasUnpublishedChanges": true,
  "latestVersion": 3,
  "liveVersion": 2,
  "archivedAt": null,
  "createdAt": "…",
  "createdBy": { "id": "…", "displayName": "Demo Editor" },
  "updatedAt": "…",
  "updatedBy": { "id": "…", "displayName": "Demo Editor" }
}
```

`latestVersion` and `liveVersion` are `null` before the first publish. The list endpoint returns the same fields minus `draft` and `validation`.

## Concurrent edits (optimistic locking)

Two people editing one draft must not overwrite each other silently.

- Each ruleset has a `revision` number, bumped by every change (draft save, identity change, restore, publish, archive).
- Responses carry it as an `ETag` header (`"14"`) and in the body.
- Every change request sends `If-Match: "14"`. If the ruleset has moved on, the API answers `412 Precondition Failed` with the current revision, and the editor can reload and reapply.
- A change request without `If-Match` gets `428 Precondition Required`, so no client can skip the check by accident.
- The update is one SQL statement, `UPDATE … WHERE id = $1 AND revision = $2`, so two saves at the same moment can't both win.

`PUT /live` (pinning) doesn't need `If-Match`: it doesn't touch the draft, and the last admin to pin wins.

## Validation

Two levels, matching the split in spec 001:

1. **Structure** (the JSON Schema): checked on every save. A draft that fails it is refused with `400` and the list of errors. So the stored draft always has the right shape, and every reader can trust its types.
2. **Cross-field rules** (unknown field, operator not allowed for the type, `BETWEEN` min > max, duplicate priorities or keys, value outside `allowedValues`): checked on every save but **don't block** it. They're returned as `validation.problems`, so the editor can show them while the user is still working.

**Publish** requires both: a draft with problems gets `422 Unprocessable Content` with the problems listed.

The cross-field checks live in a new shared library, `libs/ruleset-validation`, so the editor (spec 005) shows exactly what the API enforces. Each check gets a failing example, which also closes spec 001's last open criterion.

## Creating a ruleset

`POST /rulesets` takes only `name` and `description`. The schema needs at least one input field, so the draft starts from a small valid template:

- one input field: `amount`, NUMBER, label "Amount"
- `hitStrategy: FIRST`
- `defaultAction: { decision: REFER, reason: "No rule matched" }`
- no rules

Nothing is published until the user publishes.

## Errors

All errors are problem details (spec 002).

| Status | When                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| `400`  | Body fails the contract, or the draft fails the JSON Schema (`errors` lists each one)                        |
| `403`  | Signed in but missing the permission                                                                         |
| `404`  | No ruleset or version with that id/number                                                                    |
| `409`  | Name already taken; publish with no changes; changing an archived ruleset; pinning when nothing is published |
| `412`  | `If-Match` doesn't match the current revision                                                                |
| `422`  | Publish of a draft with cross-field problems (`problems` lists them)                                         |
| `428`  | Change request without `If-Match`                                                                            |

## Data

Two tables (Prisma):

- **rulesets:** `id`, `name` (unique, case-insensitive), `description`, `draft` (jsonb), `draftHash`, `revision`, `latestVersion`, `liveVersion`, `archivedAt`, `createdAt`, `createdById`, `updatedAt`, `updatedById`.
- **ruleset_versions:** `rulesetId` + `version` (primary key together), `content` (jsonb), `contentHash`, `comment`, `publishedAt`, `publishedById`. Nothing updates or deletes rows here.

Publishing is one transaction: check the revision, check there are changes and no problems, insert version `latestVersion + 1`, update the ruleset (latest, live if asked or first, revision).

## Seed

The seed adds the example ruleset from spec 001 (`loan-approval.json`) with two published versions, v1 live, plus an unpublished change in the draft. The UI then has something real to show from the first sign-in.

## Out of scope

- Delete (archive instead).
- Evaluating a ruleset (spec 006) and the simulator endpoints (spec 007).
- Comparing two versions (a diff view can come with spec 005 if wanted).
- Per-ruleset permissions, comments or approvals before publishing.
- Real-time co-editing; optimistic locking only reports conflicts.

## Acceptance criteria

- [x] Every endpoint above is in `contracts/openapi.yaml` first, and the generated types and Zod schemas are used by the API.
- [x] A viewer can read everything and gets `403` on every change; an editor gets `403` on pin and archive.
- [x] Two saves with the same `If-Match`: the first succeeds, the second gets `412`. A save without `If-Match` gets `428`.
- [x] Saving a draft that breaks the JSON Schema gets `400`; saving one with cross-field problems succeeds and returns them.
- [x] Publishing: an invalid draft gets `422`; an unchanged draft gets `409`; the first publish makes v1 live; later publishes move the live version only with `makeLive: true`, which needs `ruleset:pin` (`403` otherwise; added in spec 005).
- [x] Published versions never change: restoring, saving and publishing again leave earlier versions' content and hash identical.
- [x] Rollback: restoring v1 into the draft and publishing creates v3 with v1's hash.
- [x] `hasUnpublishedChanges` is false right after publishing and after restoring the latest version; reordering JSON keys in a save doesn't count as a change.
- [x] Archived rulesets are read-only (`409` on change), hidden from the default list, shown with `status=archived`, and keep their live version.
- [x] Ruleset names are unique ignoring case (`409`).
- [x] Each cross-field rule in `libs/ruleset-validation` has a failing example.
- [x] Each criterion above has an automated test against a real Postgres.

## Decisions (approved 22 Nov 2026)

1. **Concurrent edits:** `revision` + `ETag`/`If-Match` → `412`, `428` without it. **Approved.** Alternative: a `revision` field in the body and `409` on mismatch (simpler, less standard).
2. **What a draft save validates:** structure must pass (`400`); cross-field problems are returned but don't block. **Approved.** Alternatives: accept any JSON (more freedom, no type safety); block on everything (can't save half-finished work).
3. **Endpoint shape:** draft content (`PUT /draft`) separate from identity (`PATCH /rulesets/{id}`), one shared `revision`. **Approved.** Alternative: one `PUT` for the whole document.
4. **New rulesets** start from a starter template (one `amount` field). **Approved.** Alternative: `POST` requires the first input field.
5. **Archive:** read-only, hidden by default, keeps the live pin, can be unarchived. **Approved.** Alternative: archiving clears the live version.
6. **List pagination:** `page` and `pageSize` (default 20, max 100) with a `total`. **Approved.** Alternative: cursor pagination (stable under inserts, more complex; worth it only at large scale).
7. **Names unique ignoring case** ("Loan approval" and "loan approval" can't both exist). **Approved.**
8. **Seed** a realistic ruleset with history. **Approved.**
9. **Canonical JSON library:** `canonicalize` (an RFC 8785 implementation by one of the RFC's authors). **Approved.** Alternative: a hand-written "sort keys then stringify", which differs from the standard on number formatting edge cases.
