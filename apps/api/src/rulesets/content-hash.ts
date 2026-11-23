import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import type { RulesetContent } from '@rule-studio/shared-types';

// Spec 003, "No changes, no publish": a fingerprint of a ruleset's versioned content.
// The JSON is canonicalised first (RFC 8785: keys sorted, numbers and strings in
// one fixed form), so two documents that mean the same thing hash the same, no
// matter how a client ordered the keys or formatted the numbers.
export function contentHash(content: RulesetContent): string {
  const canonical = canonicalize(content);
  if (canonical === undefined) {
    throw new Error('Ruleset content cannot be canonicalised');
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
