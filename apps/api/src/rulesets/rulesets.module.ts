import { Module } from '@nestjs/common';
import { RulesetsController } from './rulesets.controller';
import { RulesetsService } from './rulesets.service';

@Module({
  controllers: [RulesetsController],
  providers: [RulesetsService],
})
export class RulesetsModule {}
