import { generateKeyPairSync } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role } from '@rule-studio/shared-types';
import { inject } from 'vitest';
import { AppModule } from '../app/app.module';
import { configureApp } from '../app/configure-app';
import { hashPassword } from '../auth/password';
import type { AppConfig } from '../common/config/env';
import { PrismaService } from '../prisma/prisma.service';

// One RSA key pair for the whole test run.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const TEST_PRIVATE_KEY_PEM = privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_URL: inject('testDatabaseUrl'),
    JWT_PRIVATE_KEY: TEST_PRIVATE_KEY_PEM,
    JWT_KEY_ID: 'test-key',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 7,
    LOGIN_RATE_LIMIT_PER_MINUTE: 1000, // high, so ordinary tests never hit it
    ...overrides,
  };
}

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  server: ReturnType<INestApplication['getHttpServer']>;
}

// Starts the real app (all modules, guards, filter) against the test database.
// `controllers` adds test-only routes, e.g. one that needs a permission.
export async function createTestApp(
  options: { config?: Partial<AppConfig>; controllers?: Type[] } = {},
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(testConfig(options.config))],
    controllers: options.controllers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), server: app.getHttpServer() };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "refresh_tokens", "users" CASCADE',
  );
}

export const TEST_PASSWORD = 'correct-horse-battery';

export async function createUser(
  prisma: PrismaService,
  role: Role,
  email = `${role.toLowerCase()}@rulestudio.test`,
) {
  return prisma.user.create({
    data: {
      email,
      displayName: `Test ${role.toLowerCase()}`,
      role,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
}
