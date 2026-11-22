# 004 · UI foundation: implementation plan

**Spec:** [004-ui-foundation.md](004-ui-foundation.md) (approved)
**Status:** Awaiting approval

Built in one go once approved (see "How we work" in `CLAUDE.md`), then summarised in `004-ui-foundation.summary.md`. Each task lists the interview questions it relates to.

## Versions (checked 22 Nov 2026)

| Package                                              | Use                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `tailwindcss` + `@tailwindcss/vite` **4.3**          | Styling; the Vite plugin supports Vite 8                          |
| `shadcn` CLI **4.x**                                 | Copies component source into `libs/ui`                            |
| `radix-ui` **1.8**                                   | Accessible primitives under the shadcn components                 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Component variants and class merging (what shadcn components use) |
| `lucide-react`                                       | Icons                                                             |
| `storybook` **10** + `@nx/storybook` **24.0.4**      | Component workshop for `libs/ui`                                  |
| `axe-core`                                           | Automated accessibility checks in component tests                 |

## Tasks

### 1. Proof: CSS through Module Federation

- Give one remote a stylesheet and check how the shell receives it, in dev and in a production build.
- Decide how each remote's utility CSS reaches the page (bundled with its exposed module, or linked by the remote).
- **Done when:** a style defined only in a remote shows up when the shell loads that remote, in both modes.
- _Interview:_ How do micro frontends share styles? How do you stop one remote's CSS from breaking another?

### 2. Tailwind and design tokens

- Add Tailwind to the shell and all three remotes.
- In `libs/ui/src/styles/`: `tokens.css` (every token, light and dark), `theme.css` (maps Tailwind's theme to the tokens), `global.css` (reset + tokens + theme, loaded by the shell), and a utilities-only entry for remotes.
- Each remote's standalone entry also loads `global.css`, so it looks right on its own.
- **Done when:** `bg-primary` renders the same colour in every app; switching the theme on `<html>` changes all of them.
- _Interview:_ What are design tokens, and why semantic names? Utility-first CSS vs CSS Modules. How does Tailwind keep CSS small?

### 3. Theme switching

- Theme state lives on `<html data-theme>`, not in a React context, so remotes need no JavaScript to follow it.
- A small `useTheme` hook (light / dark / system), the choice saved in localStorage, system changes followed live.
- An inline script in the shell's `index.html` sets the theme before first paint, so there is no flash of the wrong theme.
- **Done when:** the choice survives a reload, and "system" follows the OS setting.
- _Interview:_ How do you avoid a flash of the wrong theme? Why not put the theme in React context in a micro frontend?

### 4. Components in `libs/ui`

- Set up shadcn for the library (`components.json`, the `cn()` helper).
- Add with the CLI: `Button`, `Input`, `Label`, `Card`, `Alert`, `Badge`, `Skeleton`.
- Write: `Spinner`, `FormField` (label, hint and error wired with `aria-describedby` and `aria-invalid`), `EmptyState`, `ErrorState`, `ThemeToggle`, and the `AppShell` layout pieces.
- `Badge` gets `approve`, `reject` and `refer` variants that always show the word as well as the colour.
- **Done when:** every component is exported from `@rule-studio/ui` and uses only tokens.
- _Interview:_ Why copy components (shadcn) instead of installing a library? What does Radix do for accessibility? How does `cva` model variants?

### 5. Tests

- Behaviour tests for each component (React Testing Library): roles, labels, keyboard, disabled and loading states.
- An `axe-core` check on each component's main states.
- A contrast test that reads the token values and checks every text/background pair against WCAG AA (4.5:1), in both themes.
- **Done when:** all pass, and a deliberately bad colour makes the contrast test fail.
- _Interview:_ How do you test accessibility automatically, and what can't be automated?

### 6. Storybook

- Set up Storybook for `libs/ui` with `@nx/storybook`.
- A story for each component and its states, and a toolbar switch for light and dark.
- **Done when:** `npx nx storybook ui` shows every component in both themes, and the Storybook build passes.
- _Interview:_ What is Storybook for in a team, and how does it fit with a design system?

### 7. Use it in the apps

- The shell renders the `AppShell` frame with the theme toggle.
- Each remote's placeholder is rebuilt with `Card`, `Button` and `Badge`.
- **Done when:** every acceptance criterion in the spec passes, inside the shell and standalone.

### 8. Docs and summary

- `CLAUDE.md`: frontend conventions for Tailwind and tokens (no hard-coded colours or pixel values; new components go in `libs/ui`).
- `docs/commands.md`: the new commands (`shadcn add`, Storybook).
- `specs/004-ui-foundation.summary.md`: what was built, decisions, libraries, problems found, interview points.

## After this spec

Spec 002's tasks 8–9 (login page, routing, host prop) are built on these components.
