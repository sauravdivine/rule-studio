# 001 · Ruleset data model

**Status:** Approved
**Contract:** [`contracts/ruleset.schema.json`](../contracts/ruleset.schema.json)
**Example:** [`contracts/examples/loan-approval.json`](../contracts/examples/loan-approval.json)

## Goal

Define the one shape that the rule editor, the rule engine, the simulator and the AI features all share. Every later spec depends on this, so it is designed first and changed only through this spec.

## User stories

- As a business user, I create a ruleset, describe the input fields it works on, and add rules that reference those fields.
- As a business user, I control the order rules run in and whether the first match wins or the strictest match wins.
- As the rule engine, I can evaluate a ruleset against one data record without any other context.
- As the AI rule writer, I am given the ruleset's input fields and the schema, and must return a rule that validates against it.

## Model

The schema describes a ruleset's **working document**: its identity plus its rule content. Publishing, versions and which version is live are defined in [spec 003](003-rulesets-api.md), not here.

### Ruleset

| Field                    | Type                  | Part of           | Notes                                                                  |
| ------------------------ | --------------------- | ----------------- | ---------------------------------------------------------------------- |
| `id`                     | UUID                  | Identity          | Server-assigned                                                        |
| `name`                   | string, 1–100 chars   | Identity          | Unique per owner (enforced by the API, spec 003)                       |
| `description`            | string, ≤ 500 chars   | Identity          | Optional                                                               |
| `schemaVersion`          | `1`                   | Versioned content | Version of this JSON format, not of the content; see Schema versioning |
| `inputFields`            | InputField[], 1–50    | Versioned content | The input data model; rules may only reference these                   |
| `hitStrategy`            | `FIRST` \| `PRIORITY` | Versioned content | See Evaluation                                                         |
| `defaultAction`          | Action                | Versioned content | Taken when no rule fires                                               |
| `rules`                  | Rule[], 0–200         | Versioned content |                                                                        |
| `createdAt`, `updatedAt` | date-time             | Metadata          | Server-assigned                                                        |

**Identity** fields take effect immediately and never need a publish. **Versioned content** is what a published version freezes, and what the change check in spec 003 compares.

### InputField

| Field           | Type                                        | Notes                                                    |
| --------------- | ------------------------------------------- | -------------------------------------------------------- |
| `key`           | string, `^[a-zA-Z][a-zA-Z0-9_]*$`           | Unique within the ruleset                                |
| `label`         | string                                      | Shown in the editor                                      |
| `type`          | `NUMBER` \| `STRING` \| `BOOLEAN` \| `DATE` |                                                          |
| `allowedValues` | string[]                                    | Optional, `STRING` only; turns the input into a dropdown |

### Rule

| Field         | Type                | Notes                                       |
| ------------- | ------------------- | ------------------------------------------- |
| `id`          | UUID                |                                             |
| `name`        | string, 1–100 chars |                                             |
| `description` | string, ≤ 500 chars | Optional                                    |
| `priority`    | integer ≥ 1         | Lower runs first; unique within the ruleset |
| `enabled`     | boolean             | Disabled rules are skipped                  |
| `when`        | ConditionGroup      |                                             |
| `then`        | Action              |                                             |

### ConditionGroup and Condition

A group combines its children with `AND` or `OR`. Children are conditions or nested groups, at most **3 levels** deep.

```json
{ "type": "group", "operator": "AND", "children": [ … ] }
{ "type": "condition", "field": "creditScore", "operator": "LT", "value": 600 }
```

Operators allowed per field type:

| Operator                   | NUMBER | STRING | BOOLEAN | DATE | Value                   |
| -------------------------- | ------ | ------ | ------- | ---- | ----------------------- |
| `EQ`, `NEQ`                | ✓      | ✓      | ✓       | ✓    | single                  |
| `GT`, `GTE`, `LT`, `LTE`   | ✓      |        |         | ✓    | single                  |
| `BETWEEN`                  | ✓      |        |         | ✓    | `[min, max]`, inclusive |
| `IN`, `NOT_IN`             | ✓      | ✓      |         |      | array, 1–50 items       |
| `CONTAINS`, `STARTS_WITH`  |        | ✓      |         |      | string                  |
| `IS_EMPTY`, `IS_NOT_EMPTY` | ✓      | ✓      | ✓       | ✓    | none                    |

Dates are ISO `YYYY-MM-DD` strings.

### Action

Used both by each rule's `then` and by the ruleset's `defaultAction`.

| Field      | Type                             | Notes                                 |
| ---------- | -------------------------------- | ------------------------------------- |
| `decision` | `APPROVE` \| `REJECT` \| `REFER` |                                       |
| `reason`   | string, ≤ 200 chars              | Optional, shown in simulation results |

`Action` is always an object, never a bare decision, so it can grow later (see Future: output fields).

## Evaluation (the engine implements this in spec 005)

1. Skip disabled rules. Evaluate the rest in ascending `priority`.
2. A condition on a field missing from the record is `false`, except `IS_EMPTY`, which is `true`.
3. `FIRST`: stop at the first rule whose `when` is true; its `then` is the output.
4. `PRIORITY`: evaluate every rule. The output is the `then` of the strictest decision among the rules that fired, `REJECT` > `REFER` > `APPROVE`. If several fired rules share that decision, the one with the lowest `priority` supplies the `reason`.
5. If nothing fires, the output is `defaultAction`.
6. The result has this shape, so it does not change when more outputs are added:

```json
{
  "output": { "decision": "REJECT", "reason": "Low credit score" },
  "firedRules": ["<rule id>", "…"]
}
```

`firedRules` lists the ids of every rule that fired, in evaluation order.

## Validation split

The JSON Schema checks structure: required fields, enums, lengths, nesting depth, value shapes. These cross-field rules are checked in code (shared by the editor and the API):

- Every `condition.field` exists in `inputFields`.
- Every operator is allowed for that field's type, and the value matches the type.
- `BETWEEN` has `min ≤ max`.
- Rule `priority` values are unique; input field `key` values are unique.
- `IN` / `EQ` values on a field with `allowedValues` are drawn from that list.

## Schema versioning

- `schemaVersion` is fixed at `1` in the schema (`const`). Users never see or edit it; the backend sets it.
- It changes only when the JSON format changes. The code keeps one constant, `CURRENT_SCHEMA_VERSION`.
- When version 2 arrives, the schema accepts both during the transition, and the backend migrates version 1 documents when it reads them.

## Future: output fields (not built now)

Rulesets will later be able to define `outputFields` (e.g. `creditLimit`, `interestRate`), and an `Action` will gain an optional `outputs` list next to `decision`. This is an additive change in `schemaVersion: 2`; version 1 rulesets stay valid as they are.

## Acceptance criteria

- [x] `contracts/ruleset.schema.json` exists, uses JSON Schema 2020-12, and the example ruleset validates against it.
- [x] A ruleset with 4 levels of nesting fails schema validation.
- [x] A condition with an unknown `operator` fails schema validation.
- [x] `schemaVersion` other than `1`, an unknown `hitStrategy`, and a bare-string `defaultAction` fail schema validation.
- [x] `libs/shared-types` contains TypeScript types generated from the schema by `npm run contracts:types`, and the workspace typechecks.
- [ ] Each cross-field rule above has a failing example documented for spec 004/005 tests.

## Out of scope

- Expressions or computed fields (`income * 0.4`).
- Rules that reference other rules or other rulesets.
- Decision tables, scorecards, compositions, transactions.
- Hit strategies beyond `FIRST` and `PRIORITY`.
- Per-rule version history (versioning is at ruleset level, spec 003).

## Open questions

- Is a 3-level nesting limit enough for realistic rules? Proposed: yes; revisit if the AI writer needs more.
