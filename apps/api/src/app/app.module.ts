import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../common/config/config.module';
import type { AppConfig } from '../common/config/env';
import { ProblemDetailsFilter } from '../common/errors/problem-details.filter';
import { PrismaModule } from '../prisma/prisma.module';

// The root module. It takes the validated config instead of reading process.env,
// so tests can start the app with any config they like.
@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), PrismaModule, AuthModule],
      providers: [
        // Registered here (not in main.ts) so the filter also runs in tests.
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
    };
  }
}
