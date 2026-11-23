import type {
  Ruleset,
  RulesetContent,
  RulesetSummary,
  RulesetVersion,
  RulesetVersionSummary,
  UserRef,
} from '@rule-studio/shared-types';
import { validateRulesetContent } from '@rule-studio/ruleset-validation';
import type { Prisma } from '../generated/prisma/client';

// Rows as the service loads them, with the people who changed them.
const person = { select: { id: true, displayName: true } } as const;
export const rulesetInclude = { createdBy: person, updatedBy: person } as const;
export const versionInclude = { publishedBy: person } as const;

export type RulesetRow = Prisma.RulesetGetPayload<{
  include: typeof rulesetInclude;
}>;
export type VersionRow = Prisma.RulesetVersionGetPayload<{
  include: typeof versionInclude;
}>;

const ref = (user: UserRef): UserRef => ({
  id: user.id,
  displayName: user.displayName,
});

export function toSummary(row: RulesetRow): RulesetSummary {
  return {
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    revision: row.revision,
    // Compared with the latest version, not the live one, so a rollback can be published.
    hasUnpublishedChanges:
      row.latestHash === null || row.draftHash !== row.latestHash,
    latestVersion: row.latestVersion,
    liveVersion: row.liveVersion,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: ref(row.createdBy),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: ref(row.updatedBy),
  };
}

export function toRuleset(row: RulesetRow): Ruleset {
  // The stored draft always passed the contract's schema when it was saved.
  const draft = row.draft as unknown as RulesetContent;
  const problems = validateRulesetContent(draft);
  return {
    ...toSummary(row),
    draft,
    validation: { valid: problems.length === 0, problems },
  };
}

export function toVersionSummary(
  row: VersionRow,
  liveVersion: number | null,
): RulesetVersionSummary {
  return {
    version: row.version,
    comment: row.comment,
    contentHash: row.contentHash,
    publishedAt: row.publishedAt.toISOString(),
    publishedBy: ref(row.publishedBy),
    isLive: row.version === liveVersion,
  };
}

export function toVersion(
  row: VersionRow,
  liveVersion: number | null,
): RulesetVersion {
  return {
    ...toVersionSummary(row, liveVersion),
    content: row.content as unknown as RulesetContent,
  };
}
