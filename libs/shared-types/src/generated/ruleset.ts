/**
 * GENERATED FILE. DO NOT EDIT.
 * Source: contracts/ruleset.schema.json
 * Regenerate with: npm run contracts:types
 */

/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "FieldType".
 */
export type FieldType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE';
/**
 * FIRST: the first matching rule (by priority) decides. PRIORITY: all matching rules fire; the strictest decision wins.
 *
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "HitStrategy".
 */
export type HitStrategy = 'FIRST' | 'PRIORITY';
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "Decision".
 */
export type Decision = 'APPROVE' | 'REJECT' | 'REFER';
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "LogicalOperator".
 */
export type LogicalOperator = 'AND' | 'OR';
/**
 * A single comparison. The allowed value shape depends on the operator; per-field-type checks happen in code (spec 001, Validation split).
 *
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "Condition".
 */
export type Condition =
  | SingleValueCondition
  | BetweenCondition
  | ListCondition
  | TextCondition
  | EmptinessCondition;
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "ScalarValue".
 */
export type ScalarValue = string | number | boolean;
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "OrderedValue".
 */
export type OrderedValue = string | number;

/**
 * A ruleset's working document: its identity (id, name, description) plus its rule content. Publishing and versions are defined in spec 003. See specs/001-ruleset-data-model.md.
 */
export interface Ruleset {
  id: string;
  name: string;
  description?: string;
  /**
   * Version of this JSON format, not of the ruleset's content. Bumped only when the format changes.
   */
  schemaVersion: 1;
  /**
   * The input data model: the fields rules may reference.
   *
   * @minItems 1
   * @maxItems 50
   */
  inputFields: [InputField, ...InputField[]];
  hitStrategy: HitStrategy;
  defaultAction: Action;
  /**
   * @maxItems 200
   */
  rules: Rule[];
  createdAt?: string;
  updatedAt?: string;
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "InputField".
 */
export interface InputField {
  key: string;
  label: string;
  type: FieldType;
  /**
   * @minItems 1
   * @maxItems 100
   */
  allowedValues?: [string, ...string[]];
}
/**
 * The action taken when no rule fires.
 */
export interface Action {
  decision: Decision;
  reason?: string;
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "Rule".
 */
export interface Rule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  when: ConditionGroup;
  then: Action1;
}
/**
 * Top-level group (depth 1). Children may be conditions or depth-2 groups.
 *
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "ConditionGroup".
 */
export interface ConditionGroup {
  type: 'group';
  operator: LogicalOperator;
  /**
   * @minItems 1
   * @maxItems 20
   */
  children: [
    Condition | ConditionGroupLevel2,
    ...(Condition | ConditionGroupLevel2)[],
  ];
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "SingleValueCondition".
 */
export interface SingleValueCondition {
  type: 'condition';
  field: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE';
  value: ScalarValue;
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "BetweenCondition".
 */
export interface BetweenCondition {
  type: 'condition';
  field: string;
  operator: 'BETWEEN';
  /**
   * [min, max], inclusive
   *
   * @minItems 2
   * @maxItems 2
   */
  value: [OrderedValue, OrderedValue, ...OrderedValue[]];
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "ListCondition".
 */
export interface ListCondition {
  type: 'condition';
  field: string;
  operator: 'IN' | 'NOT_IN';
  /**
   * @minItems 1
   * @maxItems 50
   */
  value: [OrderedValue, ...OrderedValue[]];
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "TextCondition".
 */
export interface TextCondition {
  type: 'condition';
  field: string;
  operator: 'CONTAINS' | 'STARTS_WITH';
  value: string;
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "EmptinessCondition".
 */
export interface EmptinessCondition {
  type: 'condition';
  field: string;
  operator: 'IS_EMPTY' | 'IS_NOT_EMPTY';
}
/**
 * Nested group (depth 2). Children may be conditions or depth-3 groups.
 *
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "ConditionGroupLevel2".
 */
export interface ConditionGroupLevel2 {
  type: 'group';
  operator: LogicalOperator;
  /**
   * @minItems 1
   * @maxItems 20
   */
  children: [
    Condition | ConditionGroupLevel3,
    ...(Condition | ConditionGroupLevel3)[],
  ];
}
/**
 * Deepest group (depth 3). Children may only be conditions.
 *
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "ConditionGroupLevel3".
 */
export interface ConditionGroupLevel3 {
  type: 'group';
  operator: LogicalOperator;
  /**
   * @minItems 1
   * @maxItems 20
   */
  children: [Condition, ...Condition[]];
}
/**
 * This interface was referenced by `Ruleset`'s JSON-Schema
 * via the `definition` "Action".
 */
export interface Action1 {
  decision: Decision;
  reason?: string;
}
