# Rule Studio

A mini decisioning platform: create **rulesets**, add **rules** inside them, test a ruleset against sample customer data, see the results on a dashboard, and use AI to write, explain and review rules.

Built with spec-driven development: every feature starts as a spec in [`specs/`](specs/), and [`contracts/`](contracts/) is the single source of truth for data shapes and the API.

## Stack

- **Frontend:** React 19, TypeScript, Vite, micro frontends with Module Federation, Nx monorepo
- **Backend:** Spring Boot 3, Java 21, PostgreSQL (coming in spec 002)
- **AI:** LLM features called from the backend (coming in specs 008–009)

## Structure

| Path                | What it is                                           |
| ------------------- | ---------------------------------------------------- |
| `apps/shell`        | Host app: layout, auth, loads the remotes at runtime |
| `apps/rule-editor`  | Remote: rulesets and rules                           |
| `apps/simulator`    | Remote: run a ruleset on sample data                 |
| `apps/dashboard`    | Remote: charts over simulation runs                  |
| `libs/ui`           | Shared components                                    |
| `libs/shared-types` | Types generated from `contracts/`                    |
| `contracts/`        | JSON Schemas, OpenAPI, example payloads              |
| `specs/`            | Feature specs, in build order                        |
| `backend/`          | Spring Boot service                                  |

## Run it

Needs Node 22+ and npm 11+.

```bash
npm install
npx nx run-many -t serve -p shell rule-editor simulator dashboard
```

Open http://localhost:4200.

```bash
npm run contracts:validate   # check the schema against examples and known-bad cases
npm run contracts:types      # regenerate TypeScript types from the schema
npx nx run-many -t lint test typecheck build
```
