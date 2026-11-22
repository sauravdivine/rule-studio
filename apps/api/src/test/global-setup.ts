import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';

// Runs once before all API tests. It (re)creates a separate test database next to the
// development one (e.g. rulestudio_test), then applies every Prisma migration to it.
// Tests never touch the development data.
export default async function setup(project: TestProject): Promise<void> {
  const envFile = resolve(__dirname, '../../../../.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const base = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!base) {
    throw new Error(
      'Set DATABASE_URL in .env (cp .env.example .env) before running the API tests.',
    );
  }

  const testUrl = new URL(base);
  const baseDb = testUrl.pathname.slice(1) || 'postgres';
  const testDb = process.env['TEST_DATABASE_URL'] ? baseDb : `${baseDb}_test`;
  testUrl.pathname = `/${testDb}`;

  // Connect to the main database to drop and recreate the test one.
  const admin = new Client({ connectionString: base });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${new URL(base).host}. Is it running? Try: docker compose up -d\n${String(error)}`,
    );
  }
  await admin.query(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${testDb}"`);
  await admin.end();

  // Apply the migrations in order, exactly as written in prisma/migrations.
  const migrationsDir = resolve(__dirname, '../../prisma/migrations');
  const migrations = existsSync(migrationsDir)
    ? readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
  if (migrations.length === 0) {
    throw new Error(
      'No migrations found. Create the first one with: npx nx run api:db-migrate --name=init',
    );
  }
  const db = new Client({ connectionString: testUrl.toString() });
  await db.connect();
  for (const name of migrations) {
    await db.query(
      readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8'),
    );
  }
  await db.end();

  project.provide('testDatabaseUrl', testUrl.toString());
}

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
