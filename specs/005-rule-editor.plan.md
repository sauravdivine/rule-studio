# 005 · Rule editor: implementation plan

**Spec:** [005-rule-editor.md](005-rule-editor.md) (approved 23 Nov 2026)
**Status:** Approved and built (23 Nov 2026). What was built: [005-rule-editor.summary.md](005-rule-editor.summary.md)

Built in one go once approved, then summarised in `005-rule-editor.summary.md`. The owner runs the installs and commits.

## Versions (checked 23 Nov 2026)

| Package                                     | Use                                                                | Version                                            |
| ------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `immer` (new)                               | Immutable updates to the nested draft, written as simple mutations | **11.2.9** pinned (11.2.10 is under two weeks old) |
| `sonner` (new)                              | Toasts for "Saved", "Published"…                                   | **2.0.8** pinned                                   |
| `radix-ui` 1.8 (already in `libs/ui`)       | Dialog, Select, Tabs, Checkbox, Switch primitives                  | no change                                          |
| `react-router` 8.5.1 (already in the shell) | Now also used by the rule editor, shared as a singleton            | no change                                          |

No data-fetching library in this spec (TanStack Query is deferred to the end of the project, if needed).

## Tasks

Each task lists the interview questions it prepares you for.

### 0. Close the spec 003 gap: `makeLive` needs `ruleset:pin`

- API: publishing with `makeLive: true` without `ruleset:pin` gets `403`. The first publish still goes live for anyone who can publish.
- Contract: document the rule on `PublishRequest.makeLive` and the `403`. Update spec 003 in the same commit.
- Tests: an editor publishing with `makeLive` gets `403`; an admin's works; an editor's first publish still goes live.
- _Interview:_ "How do you authorise a field inside a request, not just an endpoint?"

### 1. Proof first: routes inside a remote, with a shared router

Checked first, because the screens depend on it.

- Share `react-router` in every Module Federation config as `singleton: true, strictVersion: true, requiredVersion` (from `package.json`), like React. Move `react-router` to the root `package.json` so every app uses the same copy.
- The shell switches from `<BrowserRouter>` to `createBrowserRouter` (data router) with the same routes, because `useBlocker` (the unsaved-changes guard) only works with a data router. `/rulesets` becomes `/rulesets/*`, so the remote owns everything below it.
- The rule editor renders its own `<Routes>`: `""` for the list and `":id"` for a ruleset. Standalone, it runs inside its own router.
- Verify in a real browser, in dev and in a production build: deep link to `/rulesets/<id>`, back button, a link from the shell into the remote and out again, and one router instance (not two). Also check what happens with a deliberate version mismatch: it should refuse to load, loudly.
- _Interview:_ "How do routes work across micro frontends?" · "Which libraries must be singletons, and why is React Router one?" · "What's the risk of a shared singleton?"

### 2. `libs/ui`: new components

- Dialog (with AlertDialog for confirmations), Select, Tabs, Table, Textarea, Checkbox, Switch, Toaster (`sonner`, themed with our tokens).
- Each gets a story, behaviour tests and an axe check. `CLAUDE.md` lists them.
- _Interview:_ "What does a dialog need to be accessible?" (focus trap, Escape, focus return, `aria-modal`, a labelled title) · "Why Radix instead of building these?"

### 3. API client and data hooks, by hand

- `libs/api-client`: requests can take extra headers (for `If-Match`). The `ApiClient` type in `libs/host` follows.
- Rule editor `src/data/`: `useRulesets(query)`, `useRuleset(id)`, `useVersions(id)`, `useVersion(id, n)`, and actions (`create`, `saveDraft`, `rename`, `publish`, `restore`, `pin`, `archive`, `unarchive`). They're written with `useEffect`, `useState` and `AbortController`.
  - Each read returns `{ data, error, loading, reload }` and cancels the old request when its inputs change, so a slow, stale response can't overwrite a newer one.
  - Saves send `If-Match: "<revision>"` and turn `412` into a typed conflict.
- **Pain-point log:** each problem hand-written fetching forces us to solve (races, refetch after save, duplicate requests, sharing data between list and detail, error retry) is noted in the summary for the TanStack Query comparison.
- _Interview:_ "What goes wrong with `useEffect` fetching?" · "What is a race condition in data fetching, and how does `AbortController` help?" · "What would a library like TanStack Query give you here?"

### 4. Editor state: reducer + Immer

- `src/editor/`: a reducer over the draft document. Actions for fields, hit strategy, default action, rules and conditions, which address a condition by its path (`[ruleIndex, 0, 2]`). Immer makes each update a plain mutation inside `produce`.
- Rules for keeping the draft consistent: changing a condition's field resets an operator the new type doesn't allow; changing the operator reshapes the value (one value, two for `BETWEEN`, a list for `IN`, none for `IS_EMPTY`); groups can't go deeper than 3 levels.
- `isDirty` compares the current draft with the last saved one.
- Pure functions with unit tests, no React.
- _Interview:_ "useReducer vs useState?" · "Why immutability matters in React" · "How does Immer work?" (proxies and structural sharing)

### 5. Ruleset list screen

- The table, search (with a short delay before searching), Active/Archived tabs, pagination, the New ruleset dialog (with the `409` "name taken" shown on the field), and loading, empty and error states.
- Search, tab and page live in the URL (`?q=&status=&page=`), so a reload or a shared link shows the same list.
- _Interview:_ "Why put list state in the URL?" · "How do you debounce, and why?"

### 6. Ruleset screen: header, Save, conflicts, unsaved guard

- Header with badges and actions, Rename dialog, Archive/Unarchive (admin, with confirmation).
- Save with `If-Match`; the conflict dialog on `412`; a toast on success.
- Unsaved-changes guard: `useBlocker` for links inside the app, `beforeunload` for closing the tab.
- Draft and History tabs, with the tab in the URL.
- _Interview:_ "How do you prevent losing unsaved work?" · "How does your UI handle a 412?"

### 7. The draft editor

- Input fields table; hit strategy; default action.
- Rules list: summary line per rule (e.g. "credit score < 600 AND (…)"), enabled switch, decision badge; add, delete (with confirmation), and priority as a number.
- Rule editor with the condition builder:
  - field select, then operators filtered by type, then a value input matching the type
  - add condition or group, remove, switch AND/OR
  - fully usable from the keyboard, with labels a screen reader can follow ("Condition 2 in group 1")
- Problems panel and inline problems: each problem's JSON Pointer path maps to the control showing it, and clicking a problem moves focus there.
- Viewers and archived rulesets: the same screen, read-only.
- _Interview:_ "How do you build a recursive form component?" · "How do you keep a large form fast?" (`memo` on rows, stable callbacks) · "How do you make a complex widget keyboard accessible?"

### 8. History, publish, restore, pin

- History table; open a version read-only, reusing the editor in read-only mode.
- Publish dialog: comment, "Make this version live" (admins only; explained and always on for the first publish), disabled with a reason when not allowed. On success: toast, reload the ruleset and history.
- Restore (with confirmation when the draft has unsaved changes) and Make live (admin).
- _Interview:_ "How do you reuse one component for editing and read-only viewing?"

### 9. Tests, accessibility and docs

- Screen tests against a fake `host.api` that behaves like the spec 003 API (revisions, `412`, `409`, `422`), extending the shell's fake. One or more tests per acceptance criterion, axe on every screen, keyboard-only use of the condition builder.
- A real-browser check against the real API and seeded data: create, edit, save, conflict (two tabs), publish, restore, pin, viewer read-only.
- Docs: `CLAUDE.md` frontend conventions (remote routing, data hooks, editor reducer), `docs/commands.md`, spec 005 criteria ticked, `005-rule-editor.summary.md` including the fetching pain-point log.

## What the owner runs afterwards

1. `npm install`: adds `immer` and `sonner`, and moves `react-router` to the root.
2. `npx nx sync`, then the checks.
3. Serve the API and all apps, try the editor, then commit.

## Not in this plan

- TanStack Query (deferred to the end of the project, if needed).
- The simulator, AI features, version comparison, autosave, undo, drag-and-drop.
