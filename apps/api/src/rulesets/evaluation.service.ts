import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  EvaluateRequest,
  EvaluationResult,
  RulesetContent,
} from '@rule-studio/shared-types';
import { checkInput, evaluate } from '@rule-studio/rule-engine';
import { validateRulesetContent } from '@rule-studio/ruleset-validation';
import { PrismaService } from '../prisma/prisma.service';

// POST /api/rulesets/:id/evaluate (spec 006). A thin layer: pick the content to
// run, check the input, call the engine. The engine itself is a pure library
// (libs/rule-engine), so all the decision logic is tested without a database.
@Injectable()
export class EvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(id: string, body: EvaluateRequest): Promise<EvaluationResult> {
    const { content, version } = await this.target(id, body.target ?? 'live');

    const problems = checkInput(content.inputFields, body.input);
    if (problems.length > 0) {
      throw new BadRequestException({
        detail: `The input has ${problems.length} problem${problems.length === 1 ? '' : 's'}.`,
        errors: problems.map((p) => ({
          path: `/input${p.path}`,
          message: p.message,
        })),
      });
    }

    return {
      ...evaluate(content, body.input, { explain: body.explain === true }),
      version,
    };
  }

  private async target(
    id: string,
    target: 'live' | 'draft' | number,
  ): Promise<{ content: RulesetContent; version: number | 'draft' }> {
    const ruleset = await this.prisma.ruleset.findUnique({
      where: { id },
      select: { draft: true, liveVersion: true },
    });
    if (!ruleset)
      throw new NotFoundException({ detail: 'No ruleset with this id.' });

    if (target === 'draft') {
      const content = ruleset.draft as unknown as RulesetContent;
      const problems = validateRulesetContent(content);
      if (problems.length > 0) {
        throw new UnprocessableEntityException({
          detail:
            'The draft has problems, so it can’t be evaluated. Fix them in the editor first.',
          problems,
        });
      }
      return { content, version: 'draft' };
    }

    const number = target === 'live' ? ruleset.liveVersion : target;
    if (number === null) {
      throw new ConflictException({
        detail:
          'Nothing is live yet. Publish the draft first, or evaluate target "draft".',
      });
    }
    const found = await this.prisma.rulesetVersion.findUnique({
      where: { rulesetId_version: { rulesetId: id, version: number } },
      select: { content: true },
    });
    if (!found)
      throw new NotFoundException({
        detail: `This ruleset has no version ${number}.`,
      });
    return {
      content: found.content as unknown as RulesetContent,
      version: number,
    };
  }
}
