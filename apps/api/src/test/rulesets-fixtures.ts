import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RulesetContent } from '@rule-studio/shared-types';

// Spec 001's example ruleset, as versioned content (identity fields removed).
export function loanApprovalContent(): RulesetContent {
  const doc = JSON.parse(
    readFileSync(
      join(__dirname, '../../../../contracts/examples/loan-approval.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const { schemaVersion, inputFields, hitStrategy, defaultAction, rules } = doc;
  return {
    schemaVersion,
    inputFields,
    hitStrategy,
    defaultAction,
    rules,
  } as RulesetContent;
}
