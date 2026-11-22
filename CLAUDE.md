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
3. **Execute in one go.** Build the whole approved plan without pausing between tasks. Each acceptance criterion in the spec gets at least one test. Then report to the owner: a short step-by-step summary of what was built and why, every library added (what it solves, the main alternative), and anything worth explaining in an interview. Write the same into `specs/NNN-name.summary.md`, next to the spec and its plan, and commit it with the code: what was built, how a request flows, decisions and why, libraries added, problems found while building, and interview talking points. If a spec is built in parts, add a section to the same file for each part.

Rules that apply throughout:

- If the implementation has to differ from the spec, stop and say so. When agreed, update the spec in the same commit as the code.
- Decisions belong to the owner. When a choice is open, present the options and a recommendation, and let the owner decide.
- `contracts/` is the single source of truth for data shapes and the HTTP API. Never hand-write a type that is generated from a contract; change the contract and regenerate.

### Learning mode

The owner is building this project to learn and to explain it in interviews.

- **Commands the agent cannot run** (for example installs, Docker or migrations on the owner's machine) are listed at the end of the work, each with a one-line explanation.
- Explain the why behind non-obvious code, briefly, in the end-of-plan summary.
- **Keep `docs/commands.md` current.** When a task introduces a command worth knowing (a new tool, script, generator or fix), add it to the right section of `docs/commands.md`, with what it does, in the same commit.

Specs are numbered in build order:

| #   | Spec                                        | Status             |
| --- | ------------------------------------------- | ------------------ |
| 001 | Ruleset data model                          | Approved           |
| 002 | Auth                                        | Approved           |
| 003 | Rulesets API                                | Decisions captured |
| 004 | UI foundation: design tokens and components | Approved           |
| 005 | Rule editor                                 | Not started        |
| 006 | Rule engine                                 | Not started        |
| 007 | Simulator                                   | Not started        |
| 008 | Dashboard                                   | Not started        |
| 009 | AI rule writer                              | Not started        |
| 010 | AI explain and review                       | Not started        |

## Repository layout

```
apps/
  shell/          Module Federation host (consumer): auth, layout, routing, loads remotes
  rule-editor/    remote (provider): ruleset list, ruleset detail, rule form, AI rule writer
  simulator/      remote: run a ruleset on sample data, AI explanations
  dashboard/      remote: charts over simulation runs
  api/            NestJS backend: auth, rulesets API, simulation, AI (from spec 002)
libs/
  ui/             shared React components and design tokens
  shared-types/   TypeScript types and Zod schemas generated from contracts/ (do not edit generated files)
  permissions/    role-to-permission map and can(), used by both the API and the frontend (spec 002)
  api-client/     stateless API client: auth header, one shared refresh on 401 (spec 002)
  host/           HostProps type the shell passes to remotes: { user, can, api } (spec 002)
contracts/        JSON Schemas and the OpenAPI spec, the source of truth
  examples/       example payloads, used as test fixtures
specs/            one markdown spec per feature, plus its plan (NNN-name.plan.md) and build summary (NNN-name.summary.md)
docs/             project docs, including commands.md (every command, what it does)
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

- NestJS 11 on Node 22+, Express, as the Nx app `apps/api` on port 3000.
- PostgreSQL (Docker Compose locally), Prisma for schema, migrations and seeding.
- One Nest module per feature: `auth`, `users`, `rulesets`, `simulation`, `ai`, plus `common` for config, errors and validation.
- Controllers match `contracts/openapi.yaml` exactly. Request validation uses the Zod schemas generated from the contract; no hand-written DTO classes.
- Every error is returned as RFC 9457 problem details by one global exception filter.
- Authorise with permissions from `libs/permissions` (`@RequirePermission(...)`), never by checking role names.
- Configuration comes from environment variables, validated with Zod at startup. Secrets and keys are never in code.
- The LLM is only ever called from the API. Treat all user text and model output as untrusted data: validate model output against the ruleset JSON Schema before using or returning it.
- Tests: Vitest for unit tests, Supertest for API tests against a real Postgres.

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
docker compose up -d              # Postgres (from spec 002)
npx nx serve api                  # API on :3000 (from spec 002)
```

## Working rules for AI agents

- Ask before adding a dependency.
- Prefer small, reviewable commits that reference the spec number, e.g. `feat(rule-editor): ruleset list (spec 005)`.
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
