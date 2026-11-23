// Seeds the three demo users (spec 002) and an example ruleset with history (spec 003).
// Safe to run again: users are updated, and the ruleset is left alone if it exists.
// Run with: npx nx run api:db-seed   (reads DATABASE_URL and SEED_DEMO_PASSWORD from .env)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import type { RulesetContent } from '@rule-studio/shared-types';
import { hashPassword } from '../src/auth/password';
import {
  Prisma,
  PrismaClient,
  type Role,
} from '../src/generated/prisma/client';
import { contentHash } from '../src/rulesets/content-hash';

const DEMO_USERS: { email: string; displayName: string; role: Role }[] = [
  {
    email: 'viewer@rulestudio.dev',
    displayName: 'Demo Viewer',
    role: 'VIEWER',
  },
  {
    email: 'editor@rulestudio.dev',
    displayName: 'Demo Editor',
    role: 'EDITOR',
  },
  { email: 'admin@rulestudio.dev', displayName: 'Demo Admin', role: 'ADMIN' },
];

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  const password = process.env['SEED_DEMO_PASSWORD'];
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env first.',
    );
  }
  if (!password || password.length < 8) {
    throw new Error('Set SEED_DEMO_PASSWORD in .env (at least 8 characters).');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const passwordHash = await hashPassword(password);
    for (const user of DEMO_USERS) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          displayName: user.displayName,
          role: user.role,
          passwordHash,
        },
        create: { ...user, passwordHash },
      });
      console.log(`seeded ${user.role.padEnd(6)} ${user.email}`);
    }
    await seedLoanApproval(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Spec 001's example ruleset with some history, so the app has something real to
// show from the first sign-in: v1 (live), v2 (published, not live) and an
// unpublished change in the draft.
async function seedLoanApproval(prisma: PrismaClient): Promise<void> {
  const example = JSON.parse(
    readFileSync(
      join(__dirname, '../../../contracts/examples/loan-approval.json'),
      'utf8',
    ),
  ) as Record<string, unknown> & {
    id: string;
    name: string;
    description: string;
  };
  const nameKey = example.name.toLowerCase();
  if (await prisma.ruleset.findUnique({ where: { nameKey } })) {
    console.log(`kept   ruleset "${example.name}" (already there)`);
    return;
  }

  const { schemaVersion, inputFields, hitStrategy, defaultAction, rules } =
    example;
  const v2 = {
    schemaVersion,
    inputFields,
    hitStrategy,
    defaultAction,
    rules,
  } as RulesetContent;
  // v1 approved only scores of 780 and up; v2 lowered it to 750 (the example as written).
  const v1 = structuredClone(v2);
  setValue(v1, 'Approve strong salaried applicants', 'creditScore', 780);
  // Being worked on: refer a narrower debt ratio band.
  const draft = structuredClone(v2);
  setValue(draft, 'Refer high debt ratio', 'debtToIncome', [40, 55]);

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@rulestudio.dev' },
  });
  const editor = await prisma.user.findUniqueOrThrow({
    where: { email: 'editor@rulestudio.dev' },
  });
  const json = (content: RulesetContent) =>
    content as unknown as Prisma.InputJsonValue;
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  await prisma.$transaction([
    prisma.ruleset.create({
      data: {
        id: example.id,
        name: example.name,
        nameKey,
        description: example.description,
        draft: json(draft),
        draftHash: contentHash(draft),
        revision: 6, // create, save, publish, save, publish, save
        latestVersion: 2,
        latestHash: contentHash(v2),
        liveVersion: 1,
        createdAt: new Date(now - 14 * day),
        createdById: editor.id,
        updatedAt: new Date(now - day),
        updatedById: editor.id,
      },
    }),
    prisma.rulesetVersion.create({
      data: {
        rulesetId: example.id,
        version: 1,
        content: json(v1),
        contentHash: contentHash(v1),
        comment: 'First release',
        publishedAt: new Date(now - 10 * day),
        publishedById: admin.id,
      },
    }),
    prisma.rulesetVersion.create({
      data: {
        rulesetId: example.id,
        version: 2,
        content: json(v2),
        contentHash: contentHash(v2),
        comment: 'Lower the approval score to 750',
        publishedAt: new Date(now - 3 * day),
        publishedById: editor.id,
      },
    }),
  ]);
  console.log(
    `seeded ruleset "${example.name}" (v1 live, v2 published, draft changed)`,
  );
}

// Sets the value of the first condition on `field` in the named rule.
function setValue(
  content: RulesetContent,
  ruleName: string,
  field: string,
  value: number | number[],
): void {
  const rule = content.rules.find((r) => r.name === ruleName);
  const condition = rule?.when.children.find(
    (c) => c.type === 'condition' && c.field === field,
  );
  if (!condition || condition.type !== 'condition') {
    throw new Error(`Seed: no "${field}" condition in rule "${ruleName}"`);
  }
  (condition as { value: unknown }).value = value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
