import type { RulesetContent } from '@rule-studio/shared-types';
import { loanApprovalContent } from '../test/rulesets-fixtures';
import { contentHash } from './content-hash';

// Rebuilds an object with its keys in reverse order, at every level.
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reverseKeys(v)]),
    );
  }
  return value;
}

describe('contentHash', () => {
  const content = loanApprovalContent();

  it('is a SHA-256 hex digest', () => {
    expect(contentHash(content)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores key order, so reordering JSON is not a change', () => {
    const reordered = reverseKeys(content) as RulesetContent;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(content));
    expect(contentHash(reordered)).toBe(contentHash(content));
  });

  it('changes when anything real changes', () => {
    const changed = structuredClone(content);
    changed.defaultAction.reason = 'Something else';
    expect(contentHash(changed)).not.toBe(contentHash(content));
  });

  it('does not ignore array order: rule order is meaningful', () => {
    const swapped = structuredClone(content);
    swapped.inputFields.reverse();
    expect(contentHash(swapped)).not.toBe(contentHash(content));
  });

  // Pinned on purpose. If this fails, hashing changed, and every stored hash
  // would stop matching: "unpublished changes" would appear on every ruleset.
  it('gives the same hash as always for the example ruleset', () => {
    expect(contentHash(content)).toBe(
      '83ec8e25c096f3eb32431d14b9c3d715b09b538aac782828ea305934cbc30377',
    );
  });
});
