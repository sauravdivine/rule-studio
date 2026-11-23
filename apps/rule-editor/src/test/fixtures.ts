import type { RulesetContent } from '@rule-studio/shared-types';
// contracts/ isn't an Nx project, so the boundary rule can't know it's allowed;
// it's the shared source of truth, and this is test-only.
// eslint-disable-next-line @nx/enforce-module-boundaries
import example from '../../../../contracts/examples/loan-approval.json';

// Spec 001's example ruleset, as versioned content (identity fields removed).
export function loanApproval(): RulesetContent {
  const { schemaVersion, inputFields, hitStrategy, defaultAction, rules } =
    structuredClone(example) as unknown as RulesetContent;
  return { schemaVersion, inputFields, hitStrategy, defaultAction, rules };
}
