import { Module } from '@nestjs/common';
import { RulesetsController } from './rulesets.controller';
import { EvaluationService } from './evaluation.service';
import { RulesetsService } from './rulesets.service';

@Module({
  controllers: [RulesetsController],
  providers: [RulesetsService, EvaluationService],
})
export class RulesetsModule {}
