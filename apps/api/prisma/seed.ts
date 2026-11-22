// Seeds the three demo users (spec 002). Safe to run again: existing users are updated.
// Run with: npx nx run api:db-seed   (reads DATABASE_URL and SEED_DEMO_PASSWORD from .env)
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password';
import { PrismaClient, type Role } from '../src/generated/prisma/client';

const DEMO_USERS: { email: string; displayName: string; role: Role }[] = [
  { email: 'viewer@rulestudio.dev', displayName: 'Demo Viewer', role: 'VIEWER' },
  { email: 'editor@rulestudio.dev', displayName: 'Demo Editor', role: 'EDITOR' },
  { email: 'admin@rulestudio.dev', displayName: 'Demo Admin', role: 'ADMIN' },
];

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  const password = process.env['SEED_DEMO_PASSWORD'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
  }
  if (!password || password.length < 8) {
    throw new Error('Set SEED_DEMO_PASSWORD in .env (at least 8 characters).');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const passwordHash = await hashPassword(password);
    for (const user of DEMO_USERS) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: { displayName: user.displayName, role: user.role, passwordHash },
        create: { ...user, passwordHash },
      });
      console.log(`seeded ${user.role.padEnd(6)} ${user.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
