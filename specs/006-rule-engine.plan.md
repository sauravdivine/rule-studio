# 006 · Rule engine: implementation plan

**Spec:** [006-rule-engine.md](006-rule-engine.md) (approved 23 Nov 2026)
**Status:** Approved and built in one go (23 Nov 2026). The owner asked to implement right after approving the spec, so this plan is the record. What was built: [006-rule-engine.summary.md](006-rule-engine.summary.md)

## Versions (checked 23 Nov 2026)

| Package                      | Use                                 | Version                                    |
| ---------------------------- | ----------------------------------- | ------------------------------------------ |
| `fast-check` (new, dev only) | Property-based tests for the engine | **4.10.2** pinned (4.11.0 is two days old) |

## Tasks

### 0. Contract

- `openapi.yaml`: `POST /api/rulesets/{id}/evaluate` with `EvaluateRequest` (`target`, `input`, `explain`), `EvaluationResult` (spec 001's `output` and `firedRules`, plus `version` and an optional `trace`), and the `400`, `403`, `404`, `409`, `422` responses. Regenerate types and Zod.
- _Interview:_ "How do you version a result shape so adding outputs later doesn't break clients?"

### 1. `libs/rule-engine`: the engine

- `evaluate(content, input, { explain })`, a pure function. Rules sorted by priority, disabled ones skipped, FIRST and PRIORITY, the default action.
- Operators per type, with "missing" (absent, `null`, or `""` for text). `BETWEEN` includes both ends; text comparison is case-sensitive.
- The trace: every rule (fired, not fired, or skipped and why), every group and condition with its actual value. All conditions are evaluated, so nothing is missing from the explanation.
- _Interview:_ "How would you design a rule engine?" · "What is short-circuit evaluation, and why turn it off here?" · "Why must an engine be deterministic?"

### 2. Input checking

- `checkInput(inputFields, input) → problems`: wrong types, impossible dates, values outside `allowedValues`. Unknown keys are ignored. Each problem has a JSON Pointer path (`/creditScore`).
- _Interview:_ "Strict or lenient input validation, and why?"

### 3. Tests

- Table-driven: every operator on every type it allows, missing values, `BETWEEN` ends, `NEQ`/`NOT_IN` on missing.
- Spec 001's example with realistic applicants: approve, reject, refer, default.
- FIRST vs PRIORITY on the same input.
- Property-based (`fast-check`): generated rulesets and inputs; invariants such as "FIRST's decision is the first fired rule's", "PRIORITY is never less strict than any fired rule", "disabling a rule that didn't fire changes nothing", "the same call twice gives the same result", and "firedRules is in priority order".
- _Interview:_ "What is property-based testing, and when is it better than examples?" · "What's a good invariant?"

### 4. API endpoint

- `POST /api/rulesets/:id/evaluate` (`simulation:run`): resolve the target (live, draft, or version n), `409` with no target, `422` for a draft with problems, `400` for bad input, then the engine.
- HTTP tests against real Postgres.
- _Interview:_ "Where does business logic live in a NestJS app?" (a pure library, called by a thin service)

### 5. Docs

- `docs/commands.md` (curl example), `CLAUDE.md` (conventions, spec table), spec 006 criteria ticked, `006-rule-engine.summary.md`.

## What the owner runs afterwards

1. `npm install` (adds `fast-check`), then `npx nx sync`.
2. The checks, a curl call to try the endpoint, then commit.
