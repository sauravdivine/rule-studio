# 003 · Rulesets API

**Status:** Not started. Versioning decisions captured below; write the full spec before building.

## Decisions so far: drafts, publishing and versions

### Draft and publish

- Each ruleset has one **working draft**. Saving the draft never creates a version, and a draft may be incomplete or invalid while being edited.
- **Publish** validates the draft (schema and cross-field rules from spec 001). If it passes, the draft's versioned content is frozen into a new version `N`.
- **Published versions are immutable.** Nothing edits or deletes them.
- The publish dialog always shows a **comment** box (≤ 500 chars). The comment is optional and may be left empty.

### Version record

Each published version stores: `version` (1, 2, 3…), `comment`, `publishedAt`, `publishedBy`, `contentHash`, and a frozen copy of the versioned content (`schemaVersion`, `inputFields`, `hitStrategy`, `defaultAction`, `rules`).

Identity fields (`name`, `description`) are not versioned: changing them takes effect immediately with no publish.

### No changes, no publish

- The backend computes a SHA-256 `contentHash` of the draft's versioned content on every save, after canonicalising the JSON (RFC 8785, JCS: sorted keys, fixed formatting).
- The API returns `hasUnpublishedChanges` = draft hash ≠ **latest** published version's hash.
- The Publish button is disabled when there are no changes. The backend re-checks on publish and returns `409 Conflict` if nothing changed.
- Compare with the latest version, not the live one, so a rollback (copying an older version into the draft) can still be published.

### Live version (pinning)

- One published version per ruleset is **live**. The user chooses it.
- The **first publish** makes v1 live automatically.
- Later publishes do **not** move the pin, unless the user ticks "Make this version live" in the publish dialog.
- The user can pin any published version at any time.
- **Rollback** never edits history: copy the old version into the draft, then publish it as a new version.

### Simulator

The simulator can run the **draft** (to test before publishing) or **any published version**.

## Still to decide

- Endpoints and payloads (to go into `contracts/openapi.yaml`).
- Concurrent draft edits: optimistic locking (e.g. a draft revision number or ETag)?
- Archiving: can an archived ruleset keep a live version?
- Who may publish and pin (ties into spec 002 roles).
