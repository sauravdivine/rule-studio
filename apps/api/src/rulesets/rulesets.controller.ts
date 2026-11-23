import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  zCreateRulesetRequest,
  zPinRequest,
  zPublishRequest,
  zRulesetContent,
  zUpdateRulesetRequest,
  type CreateRulesetRequest,
  type PinRequest,
  type PublishRequest,
  type Ruleset,
  type RulesetContent,
  type RulesetPage,
  type RulesetVersion,
  type RulesetVersionSummary,
  type UpdateRulesetRequest,
} from '@rule-studio/shared-types';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { etagOf, IfMatch } from './if-match';
import { RulesetsService, type ListQuery } from './rulesets.service';

// Query strings arrive as text, so numbers are coerced here. Same limits as the
// listRulesets parameters in contracts/openapi.yaml.
const zListQuery = z.object({
  status: z.enum(['active', 'archived']).default('active'),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// The contract says a PATCH must change something (minProperties: 1); the
// generated Zod schema doesn't carry that rule, so it's added here.
const zUpdate = zUpdateRulesetRequest.refine(
  (body) => Object.keys(body).length > 0,
  {
    message: 'Send name or description.',
  },
);

const id = new ParseUUIDPipe();
const version = new ParseIntPipe();

// Spec 003. Every change answers with the new ETag, ready for the next If-Match.
@Controller('api/rulesets')
export class RulesetsController {
  constructor(private readonly rulesets: RulesetsService) {}

  @Get()
  @RequirePermission('ruleset:read')
  list(
    @Query(new ZodValidationPipe(zListQuery)) query: ListQuery,
  ): Promise<RulesetPage> {
    return this.rulesets.list(query);
  }

  @Post()
  @RequirePermission('ruleset:edit')
  async create(
    @Body(new ZodValidationPipe(zCreateRulesetRequest))
    body: CreateRulesetRequest,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    const ruleset = await this.rulesets.create(body, user);
    res.location(`/api/rulesets/${ruleset.id}`);
    return withEtag(res, ruleset);
  }

  @Get(':id')
  @RequirePermission('ruleset:read')
  async get(
    @Param('id', id) rulesetId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(res, await this.rulesets.get(rulesetId));
  }

  @Patch(':id')
  @RequirePermission('ruleset:edit')
  async update(
    @Param('id', id) rulesetId: string,
    @IfMatch() revision: number,
    @Body(new ZodValidationPipe(zUpdate)) body: UpdateRulesetRequest,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(
      res,
      await this.rulesets.updateIdentity(rulesetId, revision, body, user),
    );
  }

  @Put(':id/draft')
  @RequirePermission('ruleset:edit')
  async saveDraft(
    @Param('id', id) rulesetId: string,
    @IfMatch() revision: number,
    @Body(new ZodValidationPipe(zRulesetContent)) draft: RulesetContent,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(
      res,
      await this.rulesets.saveDraft(rulesetId, revision, draft, user),
    );
  }

  @Get(':id/versions')
  @RequirePermission('ruleset:read')
  listVersions(
    @Param('id', id) rulesetId: string,
  ): Promise<RulesetVersionSummary[]> {
    return this.rulesets.listVersions(rulesetId);
  }

  @Post(':id/versions')
  @RequirePermission('ruleset:publish')
  async publish(
    @Param('id', id) rulesetId: string,
    @IfMatch() revision: number,
    @Body(new ZodValidationPipe(zPublishRequest)) body: PublishRequest,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RulesetVersion> {
    const result = await this.rulesets.publish(rulesetId, revision, body, user);
    res.location(
      `/api/rulesets/${rulesetId}/versions/${result.version.version}`,
    );
    res.setHeader('ETag', etagOf(result.revision));
    return result.version;
  }

  @Get(':id/versions/:version')
  @RequirePermission('ruleset:read')
  getVersion(
    @Param('id', id) rulesetId: string,
    @Param('version', version) number: number,
  ): Promise<RulesetVersion> {
    return this.rulesets.getVersion(rulesetId, number);
  }

  @Post(':id/versions/:version/restore')
  @HttpCode(200)
  @RequirePermission('ruleset:edit')
  async restore(
    @Param('id', id) rulesetId: string,
    @Param('version', version) number: number,
    @IfMatch() revision: number,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(
      res,
      await this.rulesets.restore(rulesetId, number, revision, user),
    );
  }

  @Put(':id/live')
  @RequirePermission('ruleset:pin')
  async pin(
    @Param('id', id) rulesetId: string,
    @Body(new ZodValidationPipe(zPinRequest)) body: PinRequest,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(
      res,
      await this.rulesets.pin(rulesetId, body.version, user),
    );
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermission('ruleset:archive')
  async archive(
    @Param('id', id) rulesetId: string,
    @IfMatch() revision: number,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(
      res,
      await this.rulesets.archive(rulesetId, revision, user),
    );
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  @RequirePermission('ruleset:archive')
  async unarchive(
    @Param('id', id) rulesetId: string,
    @IfMatch() revision: number,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset> {
    return withEtag(
      res,
      await this.rulesets.unarchive(rulesetId, revision, user),
    );
  }
}

function withEtag(res: Response, ruleset: Ruleset): Ruleset {
  res.setHeader('ETag', etagOf(ruleset.revision));
  return ruleset;
}
