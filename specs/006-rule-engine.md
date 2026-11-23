# 006 · Rule engine

**Status:** Built (23 Nov 2026). Plan: [006-rule-engine.plan.md](006-rule-engine.plan.md) · Summary: [006-rule-engine.summary.md](006-rule-engine.summary.md)
**Depends on:** [001 · Ruleset data model](001-ruleset-data-model.md) (the evaluation rules), [003 · Rulesets API](003-rulesets-api.md)

## Goal

Turn a ruleset and one input record into a decision: approve, reject or refer, with a reason. Follow spec 001's evaluation rules exactly, and explain _why_: which rules fired, and which conditions were true or false.

This is the heart of Rule Studio. The simulator (007) runs it over many records, the dashboard (008) charts its results, and the AI explanation (010) reads its trace.

## User stories

- As anyone signed in, I send one input record to a ruleset and get its decision and reason.
- As an editor, I can evaluate the draft (to test before publishing), the live version, or any published version.
- As anyone, I can see why: every rule that was checked, whether it fired, and each condition's result with the actual value it compared.
- As a developer, I can trust the engine: it's deterministic, the same in every environment, and every operator on every type is tested.

## What spec 001 already decided

1. Skip disabled rules; evaluate the rest in ascending `priority`.
2. A condition on a field missing from the record is `false`, except `IS_EMPTY`, which is `true`.
3. `FIRST`: stop at the first rule whose `when` is true.
4. `PRIORITY`: evaluate every rule; the strictest decision wins (`REJECT` > `REFER` > `APPROVE`), and the lowest priority among those supplies the reason.
5. Nothing fires: the output is `defaultAction`.
6. The result is `{ output: { decision, reason }, firedRules: [ids in evaluation order] }`.

## What this spec adds

### Where it lives

A pure TypeScript library, `libs/rule-engine`: `evaluate(content, input, options) → result`. It has no I/O, no clock and no randomness, so the same inputs always give the same answer. The API runs it; the browser could too (decision 1).

### The API endpoint

`POST /api/rulesets/{id}/evaluate`, permission `simulation:run`.

```json
{
  "target": "live",
  "input": { "creditScore": 640, "employmentType": "SALARIED" },
  "explain": true
}
```

- `target`: `"live"` (default), `"draft"`, or a version number.
- `409` when the target doesn't exist yet (no live version, nothing published).
- `422` when the draft has problems (it can't be evaluated meaningfully).
- `400` when the input breaks the rules below.

The answer is spec 001's result, plus `version` (which version ran, or `"draft"`) and, with `explain: true`, the `trace`.

### The input record

- An object keyed by input field `key`.
- **Missing** means the key is absent, or `null`. For a text field, an empty string `""` also counts as missing. `IS_EMPTY` is true for all three.
- **Unknown keys** (not an input field) are ignored, so callers can send a bigger record.
- **Wrong types** are refused with `400`, listing every problem (decision 3): `"700"` for a number field, `"yes"` for a true/false field, `"2026-02-30"` for a date.
- For a text field with `allowedValues`, a value outside the list is refused too.

### Operator semantics spec 001 left open

| Question                            | Answer (approved)                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `BETWEEN` ends                      | Inclusive: `[40, 60]` matches 40 and 60                                                |
| Text comparison                     | Case-sensitive for `EQ`, `NEQ`, `IN`, `NOT_IN`, `CONTAINS`, `STARTS_WITH` (decision 4) |
| `NEQ` / `NOT_IN` on a missing field | `false`, as spec 001's rule 2 says (like SQL's NULL: "unknown" isn't "different")      |
| Dates                               | Compared as `YYYY-MM-DD` strings, which sort correctly. No "today" or relative dates   |
| Numbers                             | JavaScript numbers. No rounding; the input is compared as sent                         |

### The trace

With `explain: true`, the result includes, for every rule in evaluation order:

- `ruleId`, `name`, `priority`, and `status`: `fired`, `notFired`, `disabled`, or `notReached` (after a `FIRST` match)
- for each condition: the field, operator, expected value, the **actual** value from the input, and `true`/`false`
- for each group: its operator and result

All conditions of a checked rule are evaluated, even after the result is known, so the trace shows everything (decision 5).

## Decisions (approved 23 Nov 2026)

1. **One shared library, run by the API.** **Approved.** `libs/rule-engine` is pure TypeScript, so the browser could run it later (instant simulator previews) with the exact same results. The API's answer is the official one.
   - _Alternative:_ an engine module inside the API only. Simpler, but the browser could never run it.
2. **Spec boundary.** **Approved:** 006 is the engine, plus one endpoint that evaluates **one record**. Running many records, saving runs, and the screens are spec 007 (simulator).
   - _Alternative:_ no endpoint in 006; 007 adds every endpoint.
3. **Strict input checking:** a wrong type is a `400` listing every problem. **Approved.** It's predictable, and a typo in a caller's payload doesn't quietly turn into "missing" and change the decision.
   - _Alternative:_ lenient, where a wrong type counts as missing (false). More forgiving, but silent.
4. **Case-sensitive text comparison everywhere.** **Approved.** It's exact and predictable, and `allowedValues` already keeps values consistent.
   - _Alternative:_ case-insensitive (`"salaried"` matches `"SALARIED"`). Friendlier for free text, but surprising for codes.
5. **A full trace,** with every condition evaluated and actual values shown. **Approved.** This is what the simulator and the AI explanation (010) need; the cost is trivial at 200 rules.
   - _Alternative:_ short-circuit (stop an AND at its first false). Faster, but the explanation has gaps.
6. **Who may evaluate the draft:** anyone with `simulation:run` (all roles). **Approved.** Viewers can already read the draft.
   - _Alternative:_ the draft only for editors and admins.
7. **Property-based tests** with `fast-check` (new library), on top of table-driven tests for every operator × type. **Approved.**
   - It generates thousands of random rulesets and inputs and checks rules that must always hold. For example: FIRST's decision is always the first fired rule's; PRIORITY's decision is never less strict than any fired rule's; disabling a rule that didn't fire never changes the result.
   - This is how engines are usually tested, and it's a strong interview story.
   - _Alternative:_ table-driven tests only.

## Out of scope

- Running many records at once, saving runs, and the simulator screens (spec 007).
- Charts (008); AI explanations (010).
- Relative dates ("older than 18"), computed fields, or outputs beyond `decision` and `reason` (spec 001's "future output fields").
- A public decision API for outside systems (API keys, rate limits); this endpoint is for signed-in users.

## Acceptance criteria

- [x] `libs/rule-engine` implements spec 001's evaluation rules 1–6 exactly, with a test for each.
- [x] Every operator is tested on every type it allows, including missing values, `BETWEEN` ends, and `NEQ`/`NOT_IN` on a missing field.
- [x] Spec 001's example ruleset gives the expected decision for a set of realistic applicants (approve, reject, refer, and the default).
- [x] `FIRST` and `PRIORITY` give different, correct results on the same input where they should.
- [x] Property-based tests hold for thousands of generated cases (if decision 7 is approved).
- [x] `POST /api/rulesets/{id}/evaluate` evaluates the live version, the draft, or a version number; `409` without a target, `422` for a draft with problems, `400` for bad input listing every problem.
- [x] With `explain: true`, the trace shows every rule, every condition's result and the actual value; without it, there's no trace.
- [x] The engine is deterministic: the same content and input always give the same result, and it reads no clock, environment or random source.
- [x] Each criterion above has an automated test.
