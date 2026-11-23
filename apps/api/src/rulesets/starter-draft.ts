import type { RulesetContent } from '@rule-studio/shared-types';

// What a new ruleset's draft starts as (spec 003). The schema needs at least one
// input field, so there is one placeholder the user renames or replaces.
export function starterDraft(): RulesetContent {
  return {
    schemaVersion: 1,
    inputFields: [{ key: 'amount', label: 'Amount', type: 'NUMBER' }],
    hitStrategy: 'FIRST',
    defaultAction: { decision: 'REFER', reason: 'No rule matched' },
    rules: [],
  };
}
