# 004 · UI foundation: build summary and learnings

**Spec:** [004-ui-foundation.md](004-ui-foundation.md) · **Plan:** [004-ui-foundation.plan.md](004-ui-foundation.plan.md)
**Status:** Built in one go (22 Nov 2026). All 7 acceptance criteria met.

What was built, why, which libraries came in, and what is worth being able to explain in an interview.

## What was built, task by task

| Task                                     | What                                                                                                                                                                                                                                                                                                                        | Key files                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1 · Proof: CSS through Module Federation | Checked first, because everything else depended on it. A remote-only class (`tracking-[0.42em]`) was styled correctly inside the shell, in dev **and** in a production build. In production the remote emits its own CSS file next to its exposed module, and the federation runtime loads it with the module               | `apps/*/vite.config.mts`, `apps/*/src/styles.css`                        |
| 2 · Tailwind and tokens                  | Tailwind CSS v4 through its Vite plugin. Colours, radius and shadows are CSS variables in OKLCH, defined once with light and dark values, and mapped to Tailwind classes with `@theme inline`                                                                                                                               | `libs/ui/src/styles/tokens.css`, `theme.css`, `global.css`, `remote.css` |
| 3 · Theme switching                      | Light, dark and system. The theme is the `data-theme` attribute on `<html>`; `useTheme()` reads and sets it and stores the choice in `localStorage`. An inline script in the shell's `index.html` sets it before the first paint, so there is no white flash                                                                | `libs/ui/src/lib/theme.ts`, `apps/shell/index.html`                      |
| 4 · Components                           | Button, Input, Label, FormField, Card, Alert, Badge (approve/reject/refer), Spinner, Skeleton, EmptyState, ErrorState, DropdownMenu, ThemeToggle, AppShell. shadcn/ui style on Radix, written by hand because the shadcn registry is blocked in the build sandbox; `components.json` is set up so the CLI works on your Mac | `libs/ui/src/components`, `libs/ui/components.json`                      |
| 5 · Tests                                | Behaviour tests (React Testing Library), an axe-core check in every component test, and a contrast test that computes every text/background pair from `tokens.css` in both themes                                                                                                                                           | `*.spec.tsx`, `libs/ui/src/styles/contrast.spec.ts`, `libs/ui/src/test/` |
| 6 · Storybook                            | Storybook 10 for `libs/ui` with a Theme switch in the toolbar; stories for every component plus a colour palette page                                                                                                                                                                                                       | `libs/ui/.storybook/`, `*.stories.tsx`                                   |
| 7 · Use in apps                          | The shell uses `AppShell` with a nav and the theme toggle. Each remote's placeholder is rebuilt with Card, Badge, Button, EmptyState and Skeleton. The error boundary now uses `ErrorState`, and its "Try again" really reloads the remote                                                                                  | `apps/shell/src/App.tsx`, `apps/shell/src/mf.ts`, `apps/*/src/App.tsx`   |
| 8 · Docs                                 | Frontend conventions in `CLAUDE.md`, a UI and Storybook section plus four troubleshooting rows in `docs/commands.md`, and this file                                                                                                                                                                                         |                                                                          |

**Tests:** 75 in `libs/ui`. That is 43 contrast checks (17 text pairs at 4.5:1 and 4 non-text pairs at 3:1, in each theme, plus one sanity check), 7 theme tests and 25 component tests, 5 of them axe scans. Lint, typecheck and test pass for all five frontend projects.

**Verified in a real browser** (Playwright, production builds):

- A dark-mode visitor gets `data-theme="dark"` even with every JavaScript module blocked, which proves the no-flash script works on its own.
- Choosing Light from the keyboard survives a reload.
- Remote styles apply inside the shell.
- With the simulator stopped, only its slot shows an error. Starting it and pressing "Try again" loads it.
- A remote run on its own is styled and themed.

## How the CSS gets to the page

1. The **shell** imports `global.css`, which holds the Tailwind reset, the tokens for both themes and the utilities used by the shell and `libs/ui`. It's loaded once for the whole page.
2. Each **remote's** exposed `App.tsx` imports its own `styles.css`, built from `remote.css`. That file holds utilities only: no reset and no token values, just `var(--primary)` references. In the build it measured about 15 KB raw and 3.3 KB gzipped, with zero reset rules and zero token definitions.
3. The remote's utilities resolve against the shell's tokens. That's why switching the theme on `<html>` recolours every remote at once, with nothing shared between bundles.
4. Shell and remotes declare the same CSS cascade layers (`theme, base, components, utilities`), so when the same utility appears twice the copies are identical and harmless.
5. A remote **run on its own** (`npx nx serve rule-editor`) imports `global.css` in its `bootstrap.tsx`, which only runs standalone, and applies the saved theme.

## Decisions and why

| Decision                                        | Why                                                                                                                                              | Alternative considered                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Tailwind v4 with tokens as CSS variables        | Theme changes are a single attribute swap with no re-render; one token change updates every app                                                  | CSS Modules, CSS-in-JS (styled-components, Emotion)             |
| shadcn/ui on Radix, code copied into `libs/ui`  | We own the code and can change anything; Radix does the hard accessibility work (focus, keyboard, ARIA)                                          | MUI, Chakra (installed as a dependency you can't easily change) |
| Theme on `<html data-theme>`, not React context | Each remote bundles its own copy of `libs/ui`, so a React context would not reach them. An attribute on `<html>` is one global everyone can read | A theme context shared through Module Federation                |
| `useSyncExternalStore` for `useTheme()`         | React's own way to subscribe to state outside React; listens for this tab, other tabs (`storage` event) and OS changes                           | `useState` + `useEffect` (can tear and miss updates)            |
| Inline blocking script in `index.html`          | Runs before the first paint, so dark-mode users never see white                                                                                  | Setting the theme in React (flashes on every load)              |
| OKLCH colours                                   | Lightness is perceptually even, so light and dark scales are easy to balance                                                                     | HSL, hex                                                        |
| Contrast checked by a test, not by axe in jsdom | jsdom computes no styles, so axe can't judge contrast there; computing it from the tokens is exact and fails the build on a bad change           | Manual checks, browser-only axe runs                            |
| Hand-written instead of `shadcn add`            | The registry is unreachable from the build sandbox; the code is the same pattern, and the CLI works for future components on your Mac            | Waiting for network access                                      |

## Libraries added

| Library                                                    | What it solves                                                                                           | Main alternative                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `tailwindcss` + `@tailwindcss/vite` 4.3                    | Utility-class styling, compiled by a Vite plugin; scans the source for the classes actually used         | CSS Modules, UnoCSS                        |
| `radix-ui` 1.8                                             | Accessible, unstyled primitives (Slot, Label, DropdownMenu): focus management, keyboard navigation, ARIA | React Aria, Headless UI                    |
| `class-variance-authority`                                 | Declares a component's variants (`variant`, `size`) as data instead of `if` chains                       | Hand-written class maps                    |
| `clsx` + `tailwind-merge` (as `cn()`)                      | Joins class names and lets a caller's class override a built-in one (`px-8` beats `px-4`)                | `classnames` (does no conflict resolution) |
| `lucide-react`                                             | Icons as tree-shakable React components                                                                  | Heroicons, react-icons                     |
| `storybook` 10 + `@storybook/react-vite` + `@nx/storybook` | Component workshop: each component in every state, in both themes, outside the app                       | Ladle, a hand-made demo page               |
| `axe-core` (dev)                                           | Automated accessibility checks in tests                                                                  | `jest-axe` (a wrapper around it)           |
| `@testing-library/user-event` (dev)                        | Simulates real clicks and key presses, not just DOM events                                               | `fireEvent`                                |
| `@testing-library/jest-dom` (dev)                          | Readable matchers: `toBeDisabled()`, `toHaveAccessibleDescription()`                                     | Raw DOM assertions                         |

## Problems found while building

| Problem                                              | What happened                                                                                                                                                                               | Fix                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| "Try again" never retried                            | Two caches remembered the failure. `React.lazy` keeps a rejected import forever, and the federation runtime keeps the failed `remoteEntry.js` promise: no new network request was even made | `RemoteSlot` creates a new `lazy()` on retry, and `resetProvider()` re-registers the remote with `force: true` and a fresh query string |
| `TS2882` on `import './styles.css'`                  | TypeScript 6 now checks side-effect imports, and the apps had no CSS type declarations; it surfaced as a Module Federation type-generation error                                            | `"types": ["vite/client"]` in each app's tsconfig                                                                                       |
| Library tsconfig had no DOM types                    | `libs/ui` was generated with `lib: ["es2022"]` only, so `window` and `document` didn't exist                                                                                                | Added `dom` and `dom.iterable`                                                                                                          |
| Test helpers built into the library                  | `src/test/setup.ts` matched the library's include pattern                                                                                                                                   | Excluded from `tsconfig.lib.json`, included in `tsconfig.spec.json`                                                                     |
| axe "region" failure on the open menu                | A whole-page rule (content inside landmarks) run on a lone component                                                                                                                        | Turned off for component tests; the AppShell test covers landmarks                                                                      |
| Lint read Storybook's minified build                 | `storybook-static` and `.mf` weren't in the ESLint ignore list                                                                                                                              | Added to `eslint.config.mjs` (and `.mf` to `.gitignore`)                                                                                |
| Outline button text turned red inside an error alert | The button inherited the alert's colour                                                                                                                                                     | `outline` and `ghost` variants set `text-foreground` explicitly                                                                         |

## Worth explaining in an interview

- **How do micro frontends share a design system without shipping CSS twice?** The shell owns the reset and tokens; remotes ship only utilities that reference the tokens through CSS variables. I measured it: remote CSS has zero reset rules and zero token definitions.
- **How does the theme reach four separately deployed apps?** It doesn't go through React at all: it's an attribute on `<html>`, and every remote's CSS reads it. A shared React context would silently break, because each remote has its own copy of the library.
- **How do you avoid the dark-mode flash?** A tiny blocking inline script in `<head>`, before any CSS or JavaScript. I proved it by blocking every JS module in Playwright and checking the attribute.
- **How do you make a failing remote recoverable?** An error boundary per remote, and on retry clear both caches, React's and the federation runtime's. That's a subtle bug most demos have.
- **How do you test accessibility?** Radix for behaviour, axe in every component test, a computed WCAG contrast test on the tokens, and keyboard-driven tests (opening the theme menu with Enter).
- **Why shadcn/ui rather than a component library?** You own the code: no fighting a library's styling API, no upgrade lock-in, and Radix still does the accessibility work.
- **What is `cn()`?** `clsx` plus `tailwind-merge`, so a caller can override a component's classes without `!important`.
- **OKLCH:** perceptually uniform lightness, which is why the contrast numbers behave predictably when you adjust a token.

## Next

Spec 002, tasks 8–9: routing, the login page with the demo buttons, the `host` prop for remotes and the viewer test, built with these components. Its summary gets a new section then.
