# 006 · Rule engine: what was built

**Spec:** [006-rule-engine.md](006-rule-engine.md) · **Plan:** [006-rule-engine.plan.md](006-rule-engine.plan.md) · **Built:** 23 Nov 2026

## Step by step

1. **Contract first.** `contracts/openapi.yaml` gained `POST /api/rulesets/{id}/evaluate` and the schemas `EvaluateRequest`, `EvaluationResult`, `RuleTrace`, `GroupTrace` (recursive) and `ConditionTrace`. Regenerating gave the types and Zod schemas both sides use.
2. **`libs/rule-engine`**, a pure TypeScript library:
   - `evaluate(content, input, { explain })` follows spec 001's six rules: it skips disabled rules, sorts by priority, and applies `FIRST` or `PRIORITY` (strictest wins: `REJECT` > `REFER` > `APPROVE`), falling back to `defaultAction`.
   - No short-circuit: every condition of a checked rule is evaluated, so the trace has no gaps. Each rule's status is `fired`, `notFired`, `disabled` or `notReached`.
   - "Missing" means absent, `null`, or `""` for a text field. Missing makes every operator false except `IS_EMPTY`.
   - `checkInput(fields, input)` lists every wrong type or disallowed value, with a plain-English message for each. Unknown keys are ignored.
3. **Tests (68):**
   - a table for every operator on every type
   - missing values
   - spec 001's applicant scenarios
   - `FIRST` vs `PRIORITY` on the same input
   - the trace
   - determinism: `Date.now` and `Math.random` throw if called, and inputs are frozen
   - **8 property-based tests** (fast-check, 1,000 random rulesets and inputs each)
4. **API endpoint.** `EvaluationService` picks the content:
   - live by default, the draft, or version _n_
   - `404` for an unknown ruleset or version
   - `409` when nothing is live
   - `422` for a draft with problems
   - `400` listing every input problem, with paths like `/input/creditScore`

   It then calls the engine. The controller route needs `simulation:run`, which every role has. There are 9 HTTP tests against real Postgres.

5. **Docs.** `CLAUDE.md` now marks 006 as built and adds the convention "decision logic lives only in `libs/rule-engine`". `docs/commands.md` gained a rule engine section with curl examples. Generated files are exempt from the `no-explicit-any` lint rule, because the recursive schema needs `z.lazy((): any => …)`.

**Checks:** lint, typecheck and test pass for all 12 projects, with 430 tests (124 of them API tests).

## Library added

| Library                   | What it solves                                                                                                                                                                                  | Main alternative                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `fast-check` 4.10.2 (dev) | Property-based testing: generates thousands of random rulesets and inputs and checks rules that must always hold. When one fails, it shrinks the case to the smallest example that still fails. | Table-driven tests only, which test just the cases you thought of. `jsverify` is older and unmaintained. |

## Interview points

- **Why a pure library?** No I/O, clock or randomness, so the same content and input always give the same answer. It's testable without a database, and the browser can run the exact same code later (instant simulator previews), while the API's answer stays the official one.
- **Property-based testing.** Example tests check the answers you expect; properties check rules that must hold for _every_ input. For example:
  - "FIRST's decision is the first fired rule under PRIORITY"
  - "disabling a rule that didn't fire changes nothing"
  - "explain never changes the decision"

  Shrinking turns a random failure into a minimal example.

- **Missing values behave like SQL's NULL.** "Unknown" isn't "different", so `NEQ` and `NOT_IN` on a missing field are false. It's a deliberate, documented choice, not an accident.
- **Strict input checking.** A wrong type is a `400` listing every problem, not a silent "missing" that quietly changes the decision.
- **No short-circuit evaluation.** A full trace costs nothing at this scale, and it's what explanations need (the simulator in 007, the AI explanation in 010).
- **Contract-first, recursive schemas.** The trace is a recursive type in OpenAPI. The generator emits `z.lazy`, so the API and the UI share one definition.
- **Thin service, fat library.** The endpoint only resolves the target and checks the input. Every decision lives in one tested place.

## Status codes

| Status | When                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------ |
| `200`  | Evaluated: `output`, `firedRules`, `version`, plus `trace` with `explain: true`                        |
| `400`  | The request breaks the contract, or the input has problems (`errors[].path` like `/input/creditScore`) |
| `404`  | No ruleset or version with that id/number                                                              |
| `409`  | Nothing is live yet                                                                                    |
| `422`  | The draft has problems (`problems` lists them)                                                         |
