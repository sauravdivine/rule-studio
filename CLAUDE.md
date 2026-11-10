# Rule Studio

A mini decisioning platform. Business users create **rulesets**, add **rules** inside them, test a ruleset against sample customer data, see results on a dashboard, and use AI to write, explain and review rules.

Portfolio project. Optimise for clean architecture, correctness and a story that is easy to explain in an interview, not for feature count.

## Scope

In scope: rulesets, rules, the rule engine, simulation, dashboard, auth, AI features.

Out of scope, do not add: compositions, transactions, features, decision flows, or any other decisioning-platform module. If a task seems to need one, stop and ask.

## How we work: spec-driven development

Every feature goes through three gates, in order. Do not skip ahead.

1. **Spec.** Draft `specs/NNN-name.md` from the owner's brief, then stop. Discuss it, raise open questions, and revise until the owner marks it **Approved**. No plan and no code before that.
2. **Plan.** Read the approved spec and anything it links to. Produce a numbered task list and stop. Build nothing until the owner approves the plan.
3. **Execute in steps.** Build one task at a time, and stop after each for review. Each acceptance criterion in the spec gets at least one test.

Rules that apply throughout:

- If the implementation has to differ from the spec, stop and say so. When agreed, update the spec in the same commit as the code.
- Decisions belong to the owner. When a choice is open, present the options and a recommendation, and let the owner decide.
- `contracts/` is the single source of truth for data shapes and the HTTP API. Never hand-write a type that is generated from a contract; change the contract and regenerate.

Specs are numbered in build order:

| #   | Spec                  | Status             |
| --- | --------------------- | ------------------ |
| 001 | Ruleset data model    | Approved           |
| 002 | Auth                  | Not started        |
| 003 | Rulesets API          | Decisions captured |
| 004 | Rule editor           | Not started        |
| 005 | Rule engine           | Not started        |
| 006 | Simulator             | Not started        |
| 007 | Dashboard             | Not started        |
| 008 | AI rule writer        | Not started        |
| 009 | AI explain and review | Not started        |

## Repository layout

```
apps/
  shell/          Module Federation host (consumer): auth, layout, routing, loads remotes
  rule-editor/    remote (provider): ruleset list, ruleset detail, rule form, AI rule writer
  simulator/      remote: run a ruleset on sample data, AI explanations
  dashboard/      remote: charts over simulation runs
libs/
  ui/             shared React components and design tokens
  shared-types/   TypeScript types generated from contracts/ (do not edit generated files)
contracts/        JSON Schemas and the OpenAPI spec, the source of truth
  examples/       example payloads, used as test fixtures
specs/            one markdown spec per feature
backend/          Spring Boot 3, Java 21, Maven (not managed by Nx's package graph)
```

## Frontend conventions

- React 19, TypeScript strict, Vite, Module Federation via `@module-federation/vite`.
- Remotes are registered at runtime in `apps/shell/src/mf.ts`. Each remote is wrapped in an error boundary so one failing remote never takes down the shell.
- Remotes never import from each other. Shared code goes in `libs/`.
- Server state: TanStack Query. Small client state: Zustand. No other state libraries.
- Forms: React Hook Form with Zod. Validation rules must match the JSON Schema in `contracts/`.
- Every data view handles loading, empty, error and success states.
- Accessible by default: semantic HTML, labelled inputs, keyboard support, visible focus.
- Tests: Vitest and React Testing Library next to the code as `*.spec.tsx`.

## Backend conventions (from spec 002 onwards)

- Spring Boot 3, Java 21, Maven wrapper (`./mvnw`), PostgreSQL, Flyway migrations.
- Package by feature: `auth`, `rulesets`, `engine`, `simulation`, `ai`.
- Controllers match `contracts/openapi.yaml` exactly.
- The LLM is only ever called from the backend. API keys come from environment variables, never from code or the frontend.
- Treat all user text and model output as untrusted data: validate model output against the ruleset JSON Schema before using or returning it.
- Tests: JUnit 5 and Mockito; integration tests for each controller.

## Commands

```
npm install                       # needs npm 11 or later
npx nx serve shell                # host on :4200
npx nx serve rule-editor          # remote on :5101
npx nx serve simulator            # remote on :5102
npx nx serve dashboard            # remote on :5103
npx nx run-many -t serve -p shell rule-editor simulator dashboard
npx nx run-many -t build
npx nx run-many -t lint test typecheck
npm run contracts:types           # regenerate libs/shared-types from contracts/
cd backend && ./mvnw spring-boot:run   # from spec 002 onwards
```

## Working rules for AI agents

- Ask before adding a dependency.
- Prefer small, reviewable commits that reference the spec number, e.g. `feat(rule-editor): ruleset list (spec 004)`.
- Do not invent APIs. If unsure how a library works, check its docs or types first.
- Do not touch generated files by hand.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
