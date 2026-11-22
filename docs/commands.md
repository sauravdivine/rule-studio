# Rule Studio command cheat sheet

Every command used in Rule Studio, grouped by tool, with what it does. Run them from the repo root (`~/Documents/vibe-code/rule-studio`) unless a row says otherwise.

Keep this file current: when a task introduces a new command, add it here in the same commit.

## Everyday workflow

A normal working session, start to finish:

1. `git pull`: get the latest from GitHub, if you worked on another machine.
2. `docker compose up -d`: start Postgres in the background.
3. `npx nx serve api`: start the API on port 3000. (First time only: see "Database and API setup" below.)
4. `npx nx run-many -t serve -p shell rule-editor simulator dashboard`: start the frontend; open http://localhost:4200.
5. Make changes. Before committing, run `npx nx run-many -t test typecheck lint`.
6. `git add .`, then `git commit -m "..."`, then `git push`.
7. `docker compose down`: stop Postgres when you're done (your data is kept).

Stop any running server with **Ctrl+C** in its terminal.

## Git and GitHub

| Command                                         | What it does                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `git status`                                    | Shows which files changed, which are staged, and which are new (untracked)                                |
| `git diff`                                      | Shows the exact line changes not yet staged                                                               |
| `git diff --staged`                             | Shows the changes that will go into the next commit                                                       |
| `git add .`                                     | Stages every change in the repo for the next commit                                                       |
| `git commit -m "message"`                       | Saves the staged changes as one commit, with a message                                                    |
| `git push`                                      | Sends your commits to GitHub                                                                              |
| `git push -u origin main`                       | First push of a branch: sends it and links your local `main` to GitHub's, so plain `git push` works after |
| `git pull`                                      | Fetches and merges the latest commits from GitHub                                                         |
| `git log --oneline`                             | Lists recent commits, one per line                                                                        |
| `git rm -r <folder>`                            | Deletes a folder **and** stages the deletion in one step                                                  |
| `git remote add origin <url>`                   | Connects the local repo to a GitHub repo (done once)                                                      |
| `git branch -M main`                            | Renames the current branch to `main`                                                                      |
| `git init`                                      | Turns a folder into a Git repo (done once)                                                                |
| `git config --global push.autoSetupRemote true` | Makes the first push of any new branch link it automatically                                              |

**Commit messages** follow a pattern: `type(area): what changed (spec NNN, task N)`, for example `feat(api): Nest skeleton (spec 002, task 3)`. Types: `feat` new feature, `fix` bug fix, `chore` setup or tooling, `docs` documentation.

## npm and packages

The repo is an **npm workspace**: each app and lib under `apps/` and `libs/` is its own package, all installed together from the root. Needs npm 11 or later.

| Command                                    | What it does                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                              | Installs everything in `package.json` and every workspace package, and links the workspace packages to each other. Run after pulling, or after editing any `package.json` |
| `npm install <pkg>`                        | Adds a runtime dependency (needed when the app runs)                                                                                                                      |
| `npm install -D <pkg>`                     | Adds a dev dependency (only needed to build, test or generate)                                                                                                            |
| `npm install <pkg>@1.2.3`                  | Pins an exact version. Used for 0.x packages, where minor versions can break things                                                                                       |
| `npm install <pkg> -w @rule-studio/<name>` | Adds a dependency to one workspace package only, such as Zod to `shared-types`                                                                                            |
| `npm run <script>`                         | Runs a script from the root `package.json`, such as `npm run contracts:types`                                                                                             |
| `npx <tool>`                               | Runs a tool installed in the repo (`npx nx`, `npx prettier`) without installing it globally                                                                               |
| `npm -v`                                   | Shows the npm version                                                                                                                                                     |
| `npm i -g npm@11`                          | Upgrades npm itself to version 11                                                                                                                                         |

**Linking a workspace package:** to use one lib from another, add it to that package's `dependencies` with version `"*"` (for example `"@rule-studio/shared-types": "*"`), then run `npm install` and `npx nx sync`.

## Nx

Nx runs **targets** (serve, build, test, lint, typecheck) on **projects** (shell, rule-editor, simulator, dashboard, api, ui, shared-types, permissions). It caches results, so a target that already passed with no changes finishes instantly.

### Running things

| Command                                                             | What it does                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npx nx serve <project>`                                            | Starts a dev server that reloads on save. `rule-editor`, `simulator` and `dashboard` also start the shell (their `dependsOn`) |
| `npx nx serve api`                                                  | Starts the API on :3000, with Node's debugger on :9229 for VS Code                                                            |
| `npx nx run-many -t serve -p shell rule-editor simulator dashboard` | Starts all four frontend apps together                                                                                        |
| `npx nx run <project>:<target>`                                     | Runs one target on one project, such as `npx nx run permissions:test`                                                         |
| `npx nx test <project>`                                             | Runs a project's Vitest tests                                                                                                 |
| `npx nx run-many -t test typecheck lint`                            | Runs those targets on every project: the check before each commit                                                             |
| `npx nx run-many -t build`                                          | Builds every project                                                                                                          |
| `--skip-nx-cache`                                                   | Add to any command to force a real rerun instead of a cached result                                                           |

### Workspace and generators

| Command                                                                                                                                                      | What it does                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `npx nx show projects`                                                                                                                                       | Lists every project in the workspace                                                                           |
| `npx nx show project <name>`                                                                                                                                 | Shows a project's targets and settings                                                                         |
| `npx nx sync`                                                                                                                                                | Updates TypeScript project references after one project starts depending on another                            |
| `npx nx g <plugin>:<generator> <path> ...`                                                                                                                   | Runs a generator that creates code, such as a library or app. Add `--dry-run` to preview without writing files |
| `npx nx g @nx/js:library libs/<name> --name=<name> --bundler=none --unitTestRunner=vitest --linter=eslint --importPath=@rule-studio/<name> --no-interactive` | Creates a plain TypeScript library (how `permissions` was made)                                                |
| `npx nx g @nx/nest:application apps/api --name=api --unitTestRunner=vitest --e2eTestRunner=none --linter=eslint --strict --useProjectJson --no-interactive`  | Created the NestJS API                                                                                         |
| `npx nx configure-ai-agents`                                                                                                                                 | Regenerates Nx's config files for AI coding tools                                                              |

**What the generator flags mean:** `--bundler=none` means a lib isn't built on its own (apps import its source); `--importPath` is the name you import it by; `--strict` turns on TypeScript's strict checks; `--no-interactive` stops it asking questions.

## Contracts

`contracts/` is the source of truth: `ruleset.schema.json` (the ruleset data model, spec 001) and `openapi.yaml` (the HTTP API, spec 002). Never edit the generated files in `libs/shared-types/src/generated/` by hand.

| Command                      | What it does                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run contracts:validate` | Checks the example rulesets pass the schema, known-bad cases fail, and `openapi.yaml` is valid OpenAPI with every `$ref` resolving |
| `npm run contracts:types`    | Regenerates the TypeScript types and Zod schemas in `libs/shared-types` from both contracts, formatted with Prettier               |

**When you change a contract:** edit the contract → `npm run contracts:validate` → `npm run contracts:types` → fix any TypeScript errors → commit the contract and the generated files together.

## Docker and Postgres

Postgres runs in a container defined in `docker-compose.yml`. Its settings come from `.env`. Docker (OrbStack or Docker Desktop) must be running first.

| Command                                       | What it does                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `cp .env.example .env`                        | Creates your local settings file (done once; `.env` is git-ignored)                              |
| `docker compose up -d`                        | Starts Postgres in the background (`-d` = detached). Downloads the image the first time          |
| `docker compose ps`                           | Shows the services and their state; `db` should say **healthy**                                  |
| `docker compose logs db`                      | Shows the database's log output, for when it won't start                                         |
| `docker compose down`                         | Stops and removes the container. Your data stays in the volume                                   |
| `docker compose down -v`                      | Stops it **and deletes all data** (`-v` removes the volume). Use to start from an empty database |
| `docker --version` / `docker compose version` | Checks Docker is installed                                                                       |
| `brew install --cask orbstack`                | Installs OrbStack, a light Docker engine for Apple Silicon Macs                                  |

**If port 5432 is taken** by another Postgres: change `POSTGRES_PORT` and the port inside `DATABASE_URL` in `.env` (for example to 5433), then `docker compose up -d` again.

## Database and API setup (spec 002)

The API's database layer is Prisma. Its schema is `apps/api/prisma/schema.prisma`; its config (which reads `.env`) is `apps/api/prisma.config.ts`. These Nx targets wrap the Prisma commands so you can run them from the repo root.

**First-time setup**, in order:

1. `docker compose up -d`: Postgres must be running.
2. `npm run jwt:keys`: creates the access-token signing key in `.env`.
3. `npx nx run api:db-migrate --name=init`: creates the first migration from the schema and applies it.
4. `npx nx run api:db-seed`: adds the three demo users.
5. `npx nx serve api`: start the API.

| Command                                           | What it does                                                                                                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run jwt:keys`                                | Generates an RS256 key pair and writes the private key (base64 PEM) and a key id into `.env`. Refuses to replace an existing key; add `-- --force` to rotate it (signs everyone out)          |
| `npx nx run api:prisma-generate`                  | Generates the typed Prisma client into `apps/api/src/generated/prisma` (git-ignored). Build, serve, test, typecheck and lint run it automatically                                             |
| `npx nx run api:db-migrate --name=<what-changed>` | `prisma migrate dev`: compares the schema with the database, writes a new SQL migration in `apps/api/prisma/migrations/`, and applies it. Run after every schema change; commit the migration |
| `npx nx run api:db-deploy`                        | `prisma migrate deploy`: applies migrations that haven't run yet, without creating new ones. What deployment uses                                                                             |
| `npx nx run api:db-seed`                          | `prisma db seed`: creates or updates the demo users `viewer@`, `editor@` and `admin@rulestudio.dev`, with the password from `SEED_DEMO_PASSWORD`                                              |
| `npx nx run api:db-studio`                        | Opens Prisma Studio, a browser UI to look at and edit the data                                                                                                                                |
| `npx nx test api`                                 | Runs the API tests. Before they start, a fresh test database (`rulestudio_test`) is created and every migration is applied, so tests never touch your dev data                                |

**Trying the auth API with curl** (with the API running):

```bash
# Sign in; -c saves the refresh cookie to a file
curl -i -c /tmp/rs.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"editor@rulestudio.dev","password":"rulestudio-demo"}'

# Use the accessToken from that response
curl -i http://localhost:3000/api/auth/me -H 'authorization: Bearer <accessToken>'

# Refresh (-b sends the saved cookie, -c saves the rotated one), then sign out
curl -i -b /tmp/rs.txt -c /tmp/rs.txt -X POST http://localhost:3000/api/auth/refresh
curl -i -b /tmp/rs.txt -c /tmp/rs.txt -X POST http://localhost:3000/api/auth/logout

# The public signing key
curl http://localhost:3000/.well-known/jwks.json
```

## Terminal basics and checking the API

| Command                                  | What it does                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pwd`                                    | Prints the folder you're in                                                                                               |
| `cd <folder>`                            | Moves into a folder                                                                                                       |
| `ls`                                     | Lists files in the current folder (`ls -a` includes hidden ones like `.env`)                                              |
| `cp <from> <to>`                         | Copies a file                                                                                                             |
| `rm <file>`                              | Deletes a file permanently (no Trash). Inside the repo, `git rm` is usually better                                        |
| **Ctrl+C**                               | Stops the command running in this terminal, such as a dev server                                                          |
| `curl -i http://localhost:3000/api/nope` | Calls the API and prints the status line, headers and body (`-i` includes headers)                                        |
| `NAME=value <command>`                   | Runs one command with an environment variable set, such as `DATABASE_URL=nope npx nx serve api` to test the startup check |
| `npx prettier --write <path>`            | Formats files to the repo's style                                                                                         |

## Troubleshooting

Problems hit so far, and the fix:

| Symptom                                                                | Cause                                                                   | Fix                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `dyld: Library not loaded ... libicui18n` when running `npm` or `node` | Homebrew updated a library Node depends on                              | `brew update && brew upgrade node` (or `brew reinstall node`)                   |
| `npm install` fails with an internal error                             | npm 10 bug with this workspace                                          | `npm i -g npm@11`                                                               |
| `The current branch main has no upstream branch`                       | First push of a branch                                                  | `git push -u origin main`                                                       |
| `zsh: command not found: docker`                                       | No Docker engine installed                                              | `brew install --cask orbstack`, then open OrbStack once                         |
| `The workspace is out of sync`                                         | A project gained a dependency on another                                | `npx nx sync`                                                                   |
| API stops at startup with `Invalid environment configuration`          | A variable in `.env` is missing or malformed (the message names it)     | Fix it in `.env`, or `cp .env.example .env` if the file is missing              |
| `port is already allocated` from Docker                                | Something else uses port 5432                                           | Change `POSTGRES_PORT` and `DATABASE_URL` in `.env`                             |
| `Debugger listening on ws://localhost:9229`                            | Normal: `nx serve api` turns on Node's debugger                         | Nothing to fix                                                                  |
| API won't start: `JWT_PRIVATE_KEY: ...`                                | No signing key in `.env` yet                                            | `npm run jwt:keys`                                                              |
| API tests: `Cannot reach Postgres`                                     | Postgres isn't running                                                  | `docker compose up -d`                                                          |
| API tests: `No migrations found`                                       | The first migration hasn't been created                                 | `npx nx run api:db-migrate --name=init`                                         |
| `The table "users" does not exist` when signing in                     | Migrations haven't been applied to the dev database                     | `npx nx run api:db-migrate`                                                     |
| `npm warn install-scripts ... not yet covered by allowScripts`         | npm 11 no longer runs packages' install scripts unless you approve them | Safe to ignore for now; everything we use works without them                    |
| `Cannot find module '../src/generated/prisma/client'`                  | The Prisma client hasn't been generated yet                             | `npx nx run api:prisma-generate` (Nx targets that need it run it automatically) |
