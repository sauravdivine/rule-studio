# 004 · UI foundation: design tokens and components

**Status:** Approved (22 Nov 2026)
**Depends on:** nothing. Spec 002's tasks 8–9 (login page, routing, host prop) are built on top of it.

## Goal

Every screen in Rule Studio, in the shell and in every remote, looks and behaves the same: same colours, spacing, type and components, light and dark themes, and accessible by default. Built once in `libs/ui`, used everywhere. No screen invents its own button.

## User stories

- As a user, every page looks like one product, even though it comes from four separately deployed apps.
- As a user, I can use the app in light or dark mode, and it follows my system setting by default.
- As a keyboard or screen-reader user, every control is reachable, labelled and shows a visible focus ring.
- As a developer building a remote, I import a `Button` or a form field from `@rule-studio/ui` and use token-based classes; I never hard-code a colour or a pixel value.

## Approach (proposed)

**Tailwind CSS v4 for styling, shadcn/ui for components, design tokens as CSS variables.**

- **Tailwind CSS** writes styles as utility classes in the markup (`px-4 text-sm bg-primary`). It only generates the classes a project actually uses.
- **shadcn/ui** is not an installed library. Its CLI copies the source of each component into `libs/ui`, where we own and can change it. The components are built on **Radix** primitives, which handle the hard accessibility work: focus, keyboard and ARIA.
- **Design tokens** are named values (`--color-primary`, `--radius-md`, `--space-4`) defined once as CSS variables. Tailwind's theme points at them, so `bg-primary` means "whatever the primary colour is in the current theme". A theme is just a different set of values.

### Why this over the alternatives

| Option                              | For                                                                                                                                                                        | Against, for this project                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tailwind + shadcn/ui (proposed)** | Components are our code; accessible (Radix); tokens are plain CSS variables, so they work across micro frontends with no shared JavaScript; very common in React job posts | More setup than a ready-made library; new to the owner                                                                                                         |
| MUI                                 | Complete, well-known (owner has used it)                                                                                                                                   | Theme lives in a React context, which Module Federation may duplicate per remote (the same problem as a shared auth store); heavier; distinctive Material look |
| Mantine, Chakra                     | Complete, nice developer experience                                                                                                                                        | Same React-context theming problem; less common in job posts                                                                                                   |
| Own CSS (CSS Modules)               | Full control                                                                                                                                                               | Slow; accessibility all on us                                                                                                                                  |

## Design tokens

Semantic names, so components say what a colour is for, not what it is:

| Group            | Tokens                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour           | `background`, `foreground`, `muted`, `muted-foreground`, `card`, `border`, `input`, `ring`, `primary` (+ `-foreground`), `secondary`, `accent`, `destructive`, `success`, `warning` |
| Decision colours | `approve`, `reject`, `refer`: used for decisions across the simulator and dashboard, so a REJECT is the same red everywhere                                                         |
| Radius           | `sm`, `md`, `lg`                                                                                                                                                                    |
| Type             | Font family (system font stack), sizes from Tailwind's scale                                                                                                                        |
| Spacing          | Tailwind's default scale                                                                                                                                                            |
| Shadow           | `sm`, `md`                                                                                                                                                                          |

- Light and dark values for every colour token. Every text/background pair meets **WCAG AA** contrast (4.5:1 for normal text).
- The theme follows the system setting (`prefers-color-scheme`) unless the user picks one; the choice is remembered (localStorage, a per-device preference).

## Styling across micro frontends

The part that is specific to this architecture:

- **The shell loads the global stylesheet once:** the CSS reset, the tokens and both themes. It also sets the theme on `<html>`.
- **Each remote ships only the utility classes it uses.** It does not load the reset or the tokens again, so a remote can't override the shell's base styles, and nothing is duplicated except identical utility rules (harmless).
- **Everyone uses the same Tailwind version and the same theme file from `libs/ui`,** so a class means the same thing in every app.
- **A remote must still look right when run on its own** (for development). Its standalone entry imports the global stylesheet too; when loaded inside the shell, only its utilities come with it.
- **To verify in the plan:** how `@module-federation/vite` delivers a remote's CSS when the shell loads it. This is the main technical risk, so the plan starts with a small proof.

## Components

Only what the next screens need (the login page, the app frame, and the states every data view must handle). More are added by the specs that need them.

| Component                     | Used for                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `Button`                      | Variants: primary, secondary, outline, ghost, destructive; sizes; loading state |
| `Input`, `Label`, `FormField` | A labelled input with hint and error text, wired up for screen readers          |
| `Card`                        | The login card, panels                                                          |
| `Alert`                       | Inline errors and notices (for example "Invalid email or password")             |
| `Badge`                       | Status and decision labels (`APPROVE` / `REJECT` / `REFER`)                     |
| `Spinner`, `Skeleton`         | Loading states                                                                  |
| `EmptyState`, `ErrorState`    | The empty and error states every data view needs (`CLAUDE.md`)                  |
| `ThemeToggle`                 | Light / dark / system                                                           |
| `AppShell` layout pieces      | Top bar and side navigation, used by the shell                                  |

Icons: **lucide-react** (shadcn/ui's default set).

## Accessibility

- Radix handles focus management, keyboard support and ARIA for interactive components.
- Every input has a visible label; errors are announced (`aria-describedby`, `aria-invalid`).
- A visible focus ring on everything focusable, using the `ring` token.
- Colour is never the only signal (for example, decision badges also show the word).

## Acceptance criteria

- [ ] `libs/ui` exports the components above, built on the tokens; no component hard-codes a colour.
- [ ] The tokens are defined once, in `libs/ui`, with light and dark values; changing one value changes every app.
- [ ] Light, dark and system themes work, and the choice survives a reload.
- [ ] The shell renders a page using `libs/ui` components, and each remote renders one too, all styled correctly when loaded inside the shell **and** when run on their own.
- [ ] Remotes do not ship the CSS reset or token definitions when loaded in the shell.
- [ ] Every colour pair used for text meets WCAG AA contrast, checked by a test.
- [ ] Each component has tests for its behaviour and accessibility (role, label, keyboard where relevant).

## Out of scope

- Charts (dashboard spec), data tables (simulator spec), the rule editor's condition builder (spec 005).
- A full component catalogue: components are added by the specs that need them.
- Animations beyond what the components include.
- Branding (logo, custom fonts).

## Decisions (agreed 22 Nov 2026)

1. Tailwind CSS v4 + shadcn/ui (Radix), with design tokens as CSS variables.
2. Storybook for `libs/ui`, now.
3. Light, dark and system themes.
4. Neutral greys with one indigo accent.
5. The component set listed above.
