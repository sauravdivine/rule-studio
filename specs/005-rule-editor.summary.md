# 005 · Rule editor: build summary and learnings

**Spec:** [005-rule-editor.md](005-rule-editor.md) · **Plan:** [005-rule-editor.plan.md](005-rule-editor.plan.md)
**Status:** Built in one go (23 Nov 2026). All 13 acceptance criteria met.

The first screens that do real work. A recruiter can now sign in as the demo editor, change a rule, save, publish, and see it in History.

## What was built, task by task

| Task                       | What                                                                                                                                                                                                                                                                                           | Key files                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 0 · Spec 003 gap           | Publishing with `makeLive: true` now needs `ruleset:pin` (`403` for editors); the first publish still goes live for anyone who can publish. Contract and spec 003 updated                                                                                                                      | `apps/api/src/rulesets/rulesets.service.ts`                                           |
| 1 · Routes inside a remote | `react-router` is a Module Federation singleton with `strictVersion`, configured once for all four apps. The shell uses a data router (`createBrowserRouter`) and mounts the editor at `/rulesets/*`; the editor has its own `<Routes>`. Proven in a browser, in dev and in a production build | `tools/mf-shared.mts`, `apps/shell/src/bootstrap.tsx`, `apps/rule-editor/src/App.tsx` |
| 2 · New components         | Dialog, ConfirmDialog, Select, Tabs, Table, Textarea, Checkbox, Switch, Toaster (sonner), with stories, tests and axe checks                                                                                                                                                                   | `libs/ui/src/components/`                                                             |
| 3 · Data, by hand          | The API client takes per-request `headers` (for `If-Match`) and an abort `signal`. In the editor, `useResource` handles loading, errors and races with `AbortController`, and typed calls cover every endpoint                                                                                 | `libs/api-client`, `apps/rule-editor/src/data/`                                       |
| 4 · Editor state           | One reducer over the draft, using Immer. Conditions are addressed by path, and it keeps the draft consistent (operator and value reshaped when the field or operator changes; at most 3 levels). `isDirty` by deep comparison                                                                  | `apps/rule-editor/src/editor/reducer.ts`, `model.ts`                                  |
| 5 · List                   | Table, search with debounce, Active/Archived tabs and pages, all in the URL; New ruleset dialog; loading, empty and error states                                                                                                                                                               | `pages/ruleset-list-page.tsx`                                                         |
| 6 · Ruleset page           | Badges, Save with `If-Match`, conflict dialog on `412`, unsaved-changes guard (`useBlocker` + `beforeunload`), Rename, Archive, Draft/History tabs in the URL                                                                                                                                  | `pages/ruleset-page.tsx`, `pages/dialogs.tsx`                                         |
| 7 · Draft editor           | Input fields table, hit strategy, default action, rule cards with summaries, the recursive condition builder, problems shown inline and in a panel (clicking a problem moves focus there)                                                                                                      | `editor/ui/`                                                                          |
| 8 · History, publish       | Version table, view a version read-only, Restore, Make live (admin), Publish dialog (make-live option for admins only)                                                                                                                                                                         | `pages/history-tab.tsx`                                                               |
| 9 · Tests and docs         | Screen tests per criterion against an in-memory fake of the spec 003 API, a real-browser run, and these docs                                                                                                                                                                                   | `App.spec.tsx`, `test/fake-rulesets-api.ts`                                           |

**Tests:**

- `rule-editor`: 43, of which 25 are screen tests and 18 are reducer and problem tests.
- `libs/ui`: 84, with 7 new.
- `api-client`: 17, with 4 new.
- API: 115, with 1 new.
- Lint, typecheck and tests pass everywhere.

**Checked in a real browser against the real API, in dev and in a production build:**

- Edit, save, publish (no make-live option for an editor), and the new version appears in History.
- The leave-without-saving dialog appears.
- Two users: the admin saves first, the editor gets the conflict dialog and loads the admin's version.
- The admin makes a version live.
- A viewer sees no inputs and no Save.
- A problem appears in the panel, Save says why it's blocked, and clicking the problem focuses the empty field.
- Create opens the new ruleset.
- No page errors.

## How an edit flows

1. **Load.** `useResource` loads `GET /api/rulesets/:id` and the reducer starts with `{ draft, saved }` both set to the server's draft.
2. **Change.** A control dispatches, for example `setConditionOperator(rule 1, path [0], 'BETWEEN')`. Inside Immer's `produce`, the reducer reshapes the value to `[600, 600]` and returns a new draft. Rules and fields that weren't touched keep their identity.
3. **Check.** `draftProblems()` runs the contract's `zRulesetContent` (structure) and `validateRulesetContent` (cross-field) on every change. Each problem's JSON Pointer path maps to a control id, so it shows inline and in the panel.
4. **Save.** `PUT /draft` with `If-Match: "<revision>"`.
   - On success, the returned ruleset replaces `saved`, so `isDirty` becomes false.
   - On `412`, the conflict dialog opens and the server's draft is untouched.
5. **Publish.** `POST /versions`. It returns the version, not the ruleset, so the page fetches the ruleset again for its new revision and badges.

## Decisions and why

| Decision                                             | Why                                                                                                                                                                                                                 | Alternative considered                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Shared `react-router` singleton with `strictVersion` | Deep links, back button and `useBlocker` work across the shell/remote boundary. A version mismatch fails **loudly**: "Version 8.5.1 from shell … does not satisfy the requirement of rule_editor which needs 8.4.0" | Host passes `navigate` and `basePath`, and the remote parses paths by hand  |
| Hand-written fetching (owner's change)               | To see what a data library replaces before adopting one; see the pain-point log below                                                                                                                               | TanStack Query now                                                          |
| Reducer + Immer for the draft                        | One recursive document; all consistency rules in one tested place; plain-looking updates that stay immutable                                                                                                        | React Hook Form field arrays, Zustand                                       |
| Structure checked in the browser too                 | The API refuses structurally invalid drafts with `400`, so the editor must catch them first and block Save                                                                                                          | Only cross-field checks in the browser, which the spec implied (see "Gaps") |
| A separate read-only view (`RulesetView`)            | Viewers and archived rulesets get "no editing controls at all", not disabled ones. The same view shows published versions                                                                                           | Disabled inputs                                                             |
| Toaster mounted inside the remote                    | sonner keeps its queue in module state, and each remote bundles its own copy                                                                                                                                        | One Toaster in the shell, which wouldn't receive remote toasts              |

## Libraries added

| Library                 | What it solves                                                                                                   | Main alternative                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `immer` 11.2.9 (pinned) | Immutable updates to a nested document, written as mutations; structural sharing keeps untouched parts identical | Hand-written spread copies at every level |
| `sonner` 2.0.8 (pinned) | Toasts, announced to screen readers through a live region                                                        | An inline success `Alert`                 |

`react-router` moved to the root `package.json` so every app shares one copy.

## Gaps the build exposed (spec-driven development in practice)

- **Spec 003: an editor could move the live version** by publishing with `makeLive`, though pinning is admin-only. Found while drafting this spec, fixed in task 0, spec 003 updated.
- **The spec only mentioned cross-field problems in the browser.** The API refuses _structurally_ invalid drafts too (an empty value, an empty group). So the editor also runs the contract's Zod schema and blocks Save until the structure is valid.
- **Zod reports a union, not a field.** A missing value in a condition was reported as "matches none of the five condition shapes", at the condition. The editor picks the shape whose `type` and `operator` match and reports _its_ errors, so the problem points at the value. This had to be decided recursively, because a group's child is itself a union of condition and group.

## Problems found while building

- **Accessible names built from text pieces.** Buttons like "View" plus a hidden " version 1" computed as "Viewversion 1" in tests. Each such button now has one `aria-label`. The same was true of the problems-panel buttons.
- **Tabs without panels.** The Active/Archived tabs pointed (`aria-controls`) at panels that didn't exist. axe caught it, and the list now sits inside the active tab's panel.
- **A table pushed the editor under the problems panel.** An `auto` grid track grows to fit a wide table, or even a truncated one-line summary, instead of letting it scroll. Fixed with `minmax(0, 1fr)` tracks (`grid-cols-1`) and `min-w-0` on the Table's scroll wrapper, in `libs/ui`, so every table benefits.
- **"Credit score is less than null."** A cleared value now shows as "…" in the rule summary.
- **`memo` would have been a false claim.** Every edit changes the editor's context value, so memoised rows re-render anyway. I removed `memo` rather than pretend. The real fix, if needed, is splitting the context so rows only subscribe to what they read.
- **`instanceof ApiError` doesn't work in a remote.** The error is built by the shell's copy of the class. Added `isApiError()`, a structural check, with a test simulating "another copy".
- **Tests that passed alone failed in a full run.** Heavy screen tests went past Vitest's 5-second limit when all 11 projects ran at once, and one test asserted a tab switch that happens just after its toast. Fixes: 20-second test limit and 3-second `findBy` waits for the editor's tests, and `waitFor` around the tab assertion. Afterwards, two full runs passed in a row.

## Pain-point log: hand-written fetching

What `useResource` and the screens had to do by hand. Each row is something TanStack Query does for you. Moving to it is deferred to the end of the project, if needed; until then this log is the comparison.

| #   | Pain                                                                                                                                          | What we did by hand                                                                                  | What TanStack Query gives                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | **Race conditions:** typing "loan" could show results for "lo" if that response arrived last                                                  | `AbortController` per request, abort on input change, ignore aborted results                         | Query keys; stale responses never overwrite newer ones                                                  |
| 2   | **No cache:** going list → ruleset → list fetches the list again and shows skeletons again                                                    | Nothing; every mount refetches                                                                       | Cached data shown at once, refetched in the background                                                  |
| 3   | **Refreshing after a change:** publish returns the version, so the ruleset needed a second request, and History needed to know when to reload | A manual `api.get` after publish; History lists `latestVersion` and `liveVersion` in its effect deps | `invalidateQueries(['ruleset', id])`                                                                    |
| 4   | **Mutation state:** loading flags for save, publish and rename, with try/finally in each                                                      | A `busy` union in state and five hand-written handlers                                               | `useMutation`: `isPending`, `onSuccess`, `onError`                                                      |
| 5   | **Duplicate requests:** opening the same version twice fetches it twice                                                                       | Nothing                                                                                              | Deduplication and cache by key                                                                          |
| 6   | **Retry:** a failed load stays failed until the user presses "Try again"                                                                      | Manual `reload()`                                                                                    | Automatic retry with backoff                                                                            |
| 7   | **Stale while away:** another user's change isn't noticed until you save (`412`)                                                              | We rely on the conflict check                                                                        | Refetch on window focus and reconnect                                                                   |
| 8   | **Copying server data into local state:** the editor's draft must follow the server's after load, save and restore, but not after a rename    | An effect with a deep-equality guard                                                                 | Still needed (the draft is client state), but `setQueryData` in `onSuccess` makes the hand-off explicit |
| 9   | **We started building a library.** `useResource` (data, error, loading, reload, setData) is a small version of `useQuery`                     | One generic hook                                                                                     | The real thing, tested and documented                                                                   |

## Worth knowing for interviews

**Micro frontends**

- **Routing across remotes:** the shell owns the URL and mounts each remote at `/section/*`; the remote declares relative routes. The router must be one instance, because its context is matched by identity. Share it as a singleton, with `strictVersion` so a mismatch fails loudly instead of silently.
- **What must and mustn't be shared:** share libraries whose _identity_ matters (React, the router). Pass _capabilities_ through props (host). Never rely on `instanceof` or module state across the boundary (`isApiError`, a Toaster per remote).

**React and state**

- **Reducer + Immer:** why one reducer for a recursive document, how Immer's proxies and structural sharing work, and why that makes "unsaved changes" a cheap comparison.
- **Unsaved-changes protection:** `useBlocker` for in-app navigation (needs a data router), `beforeunload` for closing the tab.
- **Optimistic locking in the UI:** `If-Match` on every save; on `412`, show who wins and never overwrite silently.
- **Validation where it belongs:** structure and cross-field rules run in the browser for instant feedback, with the _same_ code the API runs, so the two never disagree. The server still enforces both.
- **The fetching comparison:** be ready to walk through the pain-point log. It shows you understand what TanStack Query solves, not just how to call it.

**Accessibility**

- **A complex widget:** the recursive condition builder uses only real buttons, selects and inputs, in reading order, with labels that say where they are ("Operator, condition 2 in group 1.2, rule #2"). There's a keyboard-only test, and clicking a problem moves focus to it.
- **Read-only means no controls,** not disabled ones: a separate view, also reused for published versions.

## Next

Spec 006, the rule engine. (TanStack Query is deferred to the end of the project, if needed.)
