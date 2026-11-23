# 005 · Rule editor

**Status:** Built (23 Nov 2026). Plan: [005-rule-editor.plan.md](005-rule-editor.plan.md) · Summary: [005-rule-editor.summary.md](005-rule-editor.summary.md)
**Depends on:** [001 · Ruleset data model](001-ruleset-data-model.md), [002 · Auth](002-auth.md), [003 · Rulesets API](003-rulesets-api.md), [004 · UI foundation](004-ui-foundation.md)
**Where:** the `rule-editor` remote (`apps/rule-editor`), loaded by the shell at `/rulesets`

## Goal

The first screens that do real work: browse rulesets, edit a ruleset's draft (input fields, hit strategy, default action, rules with nested conditions), see validation problems as you type, save safely, publish, view history, roll back and pin the live version. Everything goes through the spec 003 API.

After this spec, Rule Studio is demoable: a recruiter can sign in as an editor, change a rule and publish it.

## User stories

- As anyone signed in, I see a list of rulesets with their live version and whether they have unpublished changes, and I can search and page through it.
- As an editor, I create a ruleset and land in its editor.
- As an editor, I add, change and remove input fields, choose the hit strategy and the default action.
- As an editor, I add, edit, disable, reorder and delete rules, and build each rule's conditions with AND/OR groups up to 3 levels deep, using only operators that make sense for each field's type.
- As an editor, I see problems (unknown field, `BETWEEN` the wrong way round, duplicate priority…) next to the place they are, while I type, before I save.
- As an editor, I save the draft. If someone else saved in the meantime, I'm told, not silently overwritten.
- As an editor, if I try to leave with unsaved changes, I'm warned.
- As an editor, I publish with an optional comment. Publish is disabled when there is nothing new or the draft has problems, and says why.
- As anyone, I see the version history and open any version read-only.
- As an editor, I restore an old version into the draft (rollback).
- As an admin, I make any version live, and I archive or unarchive a ruleset.
- As a viewer, I see everything read-only, with no edit controls at all.

## Screens

### Ruleset list (`/rulesets`)

- Table: name, description (one line), live version, latest version, a "Unpublished changes" badge, last updated (who, when).
- Search box (name), Active / Archived tabs, pagination.
- "New ruleset" button (editors and admins): a dialog with name and optional description. On success, go to the new ruleset.
- Loading: skeleton rows. Empty: `EmptyState` with the create action (or without it, for viewers). Error: `ErrorState` with retry.

### Ruleset (`/rulesets/:id`)

Header: name, description, status badges (live vN, unpublished changes, archived), and actions:

- **Save** (when there are unsaved changes)
- **Publish**
- A menu: Rename, Archive or Unarchive (admin)

Two tabs:

**Draft** (the editor):

- **Input fields:** a table of key, label, type and, for text fields, allowed values. Add, edit, remove. A field used by a rule warns before removal.
- **Hit strategy:** FIRST or PRIORITY, with a one-line explanation of each.
- **Default action:** decision and reason.
- **Rules:** a list ordered by priority. Each shows name, an enabled switch, its decision badge and a one-line summary of its conditions. Opening a rule edits:
  - name, description, priority, enabled
  - **conditions:** a builder with AND/OR groups up to 3 levels. Each condition picks a field, then an operator allowed for that field's type, then a value input that matches the type (number, text, a select for allowed values, true/false, a date picker, two inputs for `BETWEEN`, a multi-value input for `IN`/`NOT_IN`, nothing for `IS_EMPTY`)
  - **then:** decision and reason
- **Problems panel:** every problem from `libs/ruleset-validation`, each linking to the place it's about. The same problems show inline at that place.

**History:** versions, newest first: number, comment, who, when, live badge. Open one to see it read-only. Actions per version: **Restore into draft** (editor) and **Make live** (admin).

### Publish dialog

- Comment (optional, ≤ 500 characters).
- "Make this version live" checkbox, shown only to users who may pin (see decision 6). Always on, and explained, for the first publish.
- The publish button is disabled, with the reason shown, when there are unsaved changes ("Save first"), no changes since the latest version, or problems.

## Behaviour

- **Saving:** explicit Save, not autosave (decision 3). Save sends `If-Match` with the ETag from the last load or save.
- **Conflicts (`412`):** a dialog says someone else changed the ruleset and offers "Reload their version (your changes are discarded)" or "Keep editing". Saving again would conflict again, so nothing is overwritten.
- **Unsaved changes:** a dot or "Unsaved" label in the header. Leaving the page (a link inside the app, or closing the tab) asks first.
- **Validation:** problems are computed in the browser on every change, with the same library the API uses, so the editor and the API always agree.
- **Read-only:** viewers, and everyone on an archived ruleset, see the same screens with no editing controls.
- **Feedback:** saved, published, restored and pinned each give a short confirmation (decision 7).

## Decisions (approved 23 Nov 2026)

1. **Routing inside a remote.** The editor needs its own URLs (`/rulesets/:id`, deep links, back button).
   - **Approved:** share `react-router` between shell and remotes as a Module Federation **singleton with `strictVersion`**, so the remote's routes run inside the shell's router. The routes are nested under `/rulesets/*`.
   - Unlike the theme context, a mismatch here fails **loudly**: Module Federation refuses to load the remote if the versions don't match. That is the difference from the silent duplication we avoided in specs 002 and 004.
   - _Alternative:_ the host passes a navigation capability (`host.basePath`, `host.navigate`, the current sub-path) and the remote parses its own paths. This needs no shared library, but it's hand-rolled routing.
2. **Server data: fetched by hand first, TanStack Query later.** **Approved (owner's change).** This spec loads and saves data with small hand-written hooks (`useEffect`, `useState`, `AbortController`), kept behind one module per screen so they can be swapped later. Moving them to TanStack Query is deferred to the end of the project, and only if needed (owner, 23 Nov 2026). If it happens, the owner sees both approaches on the same screens: what hand-written fetching has to handle (race conditions, stale responses, loading and error states, refetching after a save) and what the library then removes. The build summary records each of those pain points as it's met, to compare against.
3. **Editor state: one draft document in a reducer, updated with Immer.** **Approved.**
   - The draft is one nested document (groups inside groups). A reducer with actions like `addCondition(path)` and `setOperator(path, op)` updates it, and Immer lets those updates be written as simple mutations while staying immutable.
   - Unsaved changes come from comparing with the last saved copy.
   - _Alternatives:_ React Hook Form with nested `useFieldArray`, which is awkward for recursive groups; or a Zustand store, which is more than one screen needs.
4. **Explicit Save** with an unsaved-changes guard. **Approved.** It's simple, and conflicts happen at a moment the user chose.
   - _Alternative:_ autosave after a pause in typing. That means more requests and conflicts appearing mid-typing; it can come later.
5. **Validation as you type,** in the browser with `libs/ruleset-validation`, shown inline and in a problems panel. **Approved.**
   - _Alternative:_ only show the server's problems after Save.
6. **A gap in spec 003: who may make a version live while publishing.** Pinning needs `ruleset:pin` (admin), but `POST /versions` with `makeLive: true` only checks `ruleset:publish`, so an editor could move the live version that way. **Approved:** fix it in the API as part of this spec: `makeLive: true` without `ruleset:pin` gets `403`, and the checkbox only shows for admins. The first publish still goes live automatically, for anyone who can publish.
   - _Alternative:_ allow editors to make a version live when they publish it, and update spec 002's permission table to say so.
7. **Confirmations as toasts** using `sonner` (the toast library shadcn/ui uses). **Approved.** Small, accessible (announced to screen readers), with no layout shift.
   - _Alternative:_ an inline success `Alert` near the button. No new library, but it pushes content around.
8. **New components in `libs/ui`:** Dialog, Select, Tabs, Table, Textarea, Checkbox, Switch, Toaster. They're shadcn/ui style on Radix like the rest, each with a story, tests and an axe check. **Approved.**
9. **Tests:** component and screen tests with Testing Library against a fake `host.api` (as in spec 002). **Approved.** No browser end-to-end suite yet; that can come with the deployment spec.
   - _Alternative:_ add Mock Service Worker (MSW) to fake HTTP at the network level. It's more realistic but adds another tool.

## Out of scope

- TanStack Query (deferred to the end of the project, if needed; see decision 2).
- AI rule writing and explanations (specs 009 and 010).
- Running a ruleset (the simulator, spec 007).
- Comparing two versions side by side.
- Undo/redo, autosave, real-time co-editing.
- Drag-and-drop reordering (priority numbers are edited instead).
- Mobile layout beyond "usable": this is a desktop tool.

## Acceptance criteria

- [x] The list shows rulesets from the API with live and latest version and the unpublished-changes badge; search, the Active/Archived tabs and pagination work.
- [x] An editor can create a ruleset and lands in its editor.
- [x] An editor can change input fields, hit strategy, default action and rules, including a 3-level condition group, and save. The saved draft matches the schema.
- [x] The operator list only offers operators allowed for the field's type, and the value input matches the type.
- [x] Each problem from `libs/ruleset-validation` appears inline and in the problems panel while editing, before saving.
- [x] A save that gets `412` shows the conflict dialog; nothing is overwritten.
- [x] Leaving with unsaved changes asks first.
- [x] Publish is disabled with the reason shown when there are unsaved changes, no changes or problems. Publishing creates the next version and shows it in History.
- [x] Restoring a version puts its content in the draft. An admin can make any version live; an editor never sees that option, and the API refuses `makeLive` from an editor with `403`.
- [x] A viewer sees no editing controls anywhere; an archived ruleset is read-only for everyone.
- [x] Every screen has loading, empty and error states.
- [x] Every screen passes an axe check, and the condition builder can be used with the keyboard alone.
- [x] Each criterion above has an automated test.
