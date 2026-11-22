import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_CONFIG } from '../common/config/config.module';
import type { AppConfig } from '../common/config/env';
import { PrismaClient } from '../generated/prisma/client';

// The database client, as an injectable Nest service.
// Prisma 7 talks to Postgres through a driver adapter (here node-postgres, `pg`).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
  }

  // Close the connection pool when the app shuts down (Ctrl+C, container stop, end of tests).
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
