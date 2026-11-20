import { z } from 'zod';

// Every environment variable the API reads, validated once at startup.
// If anything is missing or malformed, the app refuses to start.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type AppConfig = z.infer<typeof envSchema>;

export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Name the variable and the problem, but never print the value: it may be a secret.
    const problems = result.error.issues
      .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${problems}`);
  }
  return result.data;
}
