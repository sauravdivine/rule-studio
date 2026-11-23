import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CreateRulesetRequest,
  PublishRequest,
  Ruleset,
  RulesetContent,
  RulesetPage,
  RulesetVersion,
  RulesetVersionSummary,
  UpdateRulesetRequest,
} from '@rule-studio/shared-types';
import { can } from '@rule-studio/permissions';
import { validateRulesetContent } from '@rule-studio/ruleset-validation';
import type { AuthUser } from '../auth/auth-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { contentHash } from './content-hash';
import {
  rulesetInclude,
  toRuleset,
  toSummary,
  toVersion,
  toVersionSummary,
  versionInclude,
  type RulesetRow,
} from './ruleset.mapper';
import { starterDraft } from './starter-draft';

export interface ListQuery {
  status: 'active' | 'archived';
  q?: string;
  page: number;
  pageSize: number;
}

type Tx = Prisma.TransactionClient;

const asJson = (content: RulesetContent) =>
  content as unknown as Prisma.InputJsonValue;

// Postgres unique-constraint violation, as Prisma reports it.
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class RulesetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery): Promise<RulesetPage> {
    const where: Prisma.RulesetWhereInput = {
      archivedAt: query.status === 'archived' ? { not: null } : null,
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ruleset.findMany({
        where,
        include: rulesetInclude,
        // id breaks ties, so pages never overlap or skip when timestamps are equal
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ruleset.count({ where }),
    ]);
    return {
      items: rows.map(toSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(body: CreateRulesetRequest, user: AuthUser): Promise<Ruleset> {
    const draft = starterDraft();
    try {
      const row = await this.prisma.ruleset.create({
        data: {
          name: body.name,
          nameKey: nameKeyOf(body.name),
          description: body.description || null,
          draft: asJson(draft),
          draftHash: contentHash(draft),
          createdById: user.id,
          updatedById: user.id,
        },
        include: rulesetInclude,
      });
      return toRuleset(row);
    } catch (error) {
      throw isUniqueViolation(error) ? nameTaken(body.name) : error;
    }
  }

  async get(id: string): Promise<Ruleset> {
    return toRuleset(await this.load(this.prisma, id));
  }

  async updateIdentity(
    id: string,
    revision: number,
    body: UpdateRulesetRequest,
    user: AuthUser,
  ): Promise<Ruleset> {
    const data: Prisma.RulesetUpdateManyMutationInput = {};
    if (body.name !== undefined) {
      data.name = body.name;
      data.nameKey = nameKeyOf(body.name);
    }
    if (body.description !== undefined)
      data.description = body.description || null;
    try {
      return await this.change(id, revision, user, () => data);
    } catch (error) {
      throw isUniqueViolation(error) ? nameTaken(body.name ?? '') : error;
    }
  }

  // The body already passed the contract's schema (structure). Cross-field
  // problems don't block a save; they come back in `validation` (spec 003).
  async saveDraft(
    id: string,
    revision: number,
    draft: RulesetContent,
    user: AuthUser,
  ): Promise<Ruleset> {
    return this.change(id, revision, user, () => ({
      draft: asJson(draft),
      draftHash: contentHash(draft),
    }));
  }

  async restore(
    id: string,
    version: number,
    revision: number,
    user: AuthUser,
  ): Promise<Ruleset> {
    return this.change(id, revision, user, async (tx) => {
      const old = await tx.rulesetVersion.findUnique({
        where: { rulesetId_version: { rulesetId: id, version } },
      });
      if (!old) throw versionNotFound(version);
      return {
        draft: old.content as Prisma.InputJsonValue,
        draftHash: old.contentHash,
      };
    });
  }

  async archive(
    id: string,
    revision: number,
    user: AuthUser,
  ): Promise<Ruleset> {
    return this.change(id, revision, user, () => ({ archivedAt: new Date() }));
  }

  async unarchive(
    id: string,
    revision: number,
    user: AuthUser,
  ): Promise<Ruleset> {
    return this.change(id, revision, user, () => ({ archivedAt: null }), {
      unarchiving: true,
    });
  }

  async publish(
    id: string,
    revision: number,
    body: PublishRequest,
    user: AuthUser,
  ): Promise<{ version: RulesetVersion; revision: number }> {
    // Making a version live is pinning, which only admins may do (spec 002). The
    // endpoint needs ruleset:publish, so this one field needs its own check.
    if (body.makeLive === true && !can(user.role, 'ruleset:pin')) {
      throw new ForbiddenException({
        detail:
          'Only users who may pin the live version can publish with makeLive.',
      });
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await this.load(tx, id);
        assertWritable(row);
        assertRevision(row, revision);

        if (row.latestHash !== null && row.latestHash === row.draftHash) {
          throw new ConflictException({
            detail: `Nothing to publish: the draft is the same as version ${row.latestVersion}.`,
          });
        }
        const draft = row.draft as unknown as RulesetContent;
        const problems = validateRulesetContent(draft);
        if (problems.length > 0) {
          throw new UnprocessableEntityException({
            detail: `The draft has ${problems.length} problem${problems.length === 1 ? '' : 's'} to fix before it can be published.`,
            problems,
          });
        }

        const number = (row.latestVersion ?? 0) + 1;
        // The first publish is always live; later ones only when asked (spec 003).
        const makeLive = row.liveVersion === null || body.makeLive === true;
        const created = await tx.rulesetVersion.create({
          data: {
            rulesetId: id,
            version: number,
            content: row.draft as Prisma.InputJsonValue,
            contentHash: row.draftHash,
            comment: body.comment || null,
            publishedById: user.id,
          },
          include: versionInclude,
        });
        await this.bump(tx, row, revision, user, {
          latestVersion: number,
          latestHash: row.draftHash,
          ...(makeLive ? { liveVersion: number } : {}),
        });
        return {
          version: toVersion(created, makeLive ? number : row.liveVersion),
          revision: revision + 1,
        };
      });
    } catch (error) {
      // Two publishes from the same revision at once: both may try to insert
      // version N; the database lets only one in. The other lost the race.
      if (isUniqueViolation(error)) throw stale(revision + 1);
      throw error;
    }
  }

  // Pinning doesn't touch the draft, so it needs no If-Match and doesn't bump
  // the revision: an editor saving at the same moment isn't interrupted.
  async pin(id: string, version: number, user: AuthUser): Promise<Ruleset> {
    const row = await this.load(this.prisma, id);
    assertWritable(row);
    if (row.latestVersion === null) {
      throw new ConflictException({
        detail:
          'Nothing is published yet, so there is no version to make live.',
      });
    }
    if (version > row.latestVersion) throw versionNotFound(version);
    const updated = await this.prisma.ruleset.update({
      where: { id },
      data: {
        liveVersion: version,
        updatedAt: new Date(),
        updatedById: user.id,
      },
      include: rulesetInclude,
    });
    return toRuleset(updated);
  }

  async listVersions(id: string): Promise<RulesetVersionSummary[]> {
    const row = await this.load(this.prisma, id);
    const versions = await this.prisma.rulesetVersion.findMany({
      where: { rulesetId: id },
      include: versionInclude,
      orderBy: { version: 'desc' },
    });
    return versions.map((v) => toVersionSummary(v, row.liveVersion));
  }

  async getVersion(id: string, version: number): Promise<RulesetVersion> {
    const row = await this.load(this.prisma, id);
    const found = await this.prisma.rulesetVersion.findUnique({
      where: { rulesetId_version: { rulesetId: id, version } },
      include: versionInclude,
    });
    if (!found) throw versionNotFound(version);
    return toVersion(found, row.liveVersion);
  }

  // --- helpers ---

  private async load(db: Tx, id: string): Promise<RulesetRow> {
    const row = await db.ruleset.findUnique({
      where: { id },
      include: rulesetInclude,
    });
    if (!row)
      throw new NotFoundException({ detail: 'No ruleset with this id.' });
    return row;
  }

  // One change to a ruleset, guarded by its revision. Runs in a transaction so
  // the checks and the write see the same row.
  private async change(
    id: string,
    revision: number,
    user: AuthUser,
    makeData: (
      tx: Tx,
    ) =>
      | Prisma.RulesetUpdateManyMutationInput
      | Promise<Prisma.RulesetUpdateManyMutationInput>,
    options: { unarchiving?: boolean } = {},
  ): Promise<Ruleset> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.load(tx, id);
      if (options.unarchiving) {
        if (row.archivedAt === null)
          throw new ConflictException({
            detail: 'This ruleset is not archived.',
          });
      } else {
        assertWritable(row);
      }
      assertRevision(row, revision);
      await this.bump(tx, row, revision, user, await makeData(tx));
      return toRuleset(await this.load(tx, id));
    });
  }

  // The optimistic lock itself: the UPDATE only matches if nobody changed the row
  // since `revision`. Checking first and writing later could interleave with
  // another request; one conditional statement can't.
  private async bump(
    tx: Tx,
    row: RulesetRow,
    revision: number,
    user: AuthUser,
    data: Prisma.RulesetUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await tx.ruleset.updateMany({
      where: { id: row.id, revision },
      data: {
        ...data,
        revision: { increment: 1 },
        updatedAt: new Date(),
        updatedById: user.id,
      },
    });
    if (count === 0) {
      const current = await tx.ruleset.findUnique({
        where: { id: row.id },
        select: { revision: true },
      });
      throw stale(current?.revision ?? revision + 1);
    }
  }
}

function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

function nameTaken(name: string) {
  return new ConflictException({
    detail: `A ruleset named "${name}" already exists.`,
  });
}

function versionNotFound(version: number) {
  return new NotFoundException({
    detail: `This ruleset has no version ${version}.`,
  });
}

function stale(currentRevision: number) {
  return new PreconditionFailedException({
    detail:
      'Someone changed this ruleset after you loaded it. Reload it and apply your change again.',
    currentRevision,
  });
}

function assertRevision(row: RulesetRow, revision: number): void {
  if (row.revision !== revision) throw stale(row.revision);
}

function assertWritable(row: RulesetRow): void {
  if (row.archivedAt !== null) {
    throw new ConflictException({
      detail: 'This ruleset is archived. Unarchive it to change it.',
    });
  }
}
