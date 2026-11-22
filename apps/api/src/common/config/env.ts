import { z } from 'zod';

// Every environment variable the API reads, validated once at startup.
// If anything is missing or malformed, the app refuses to start.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  // RS256 signing key for access tokens: a PKCS#8 PEM, base64-encoded onto one line.
  // Generate a local one with `npm run jwt:keys`.
  JWT_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((value) => Buffer.from(value, 'base64').toString('utf8'))
    .refine((pem) => pem.includes('-----BEGIN PRIVATE KEY-----'), {
      message: 'must be a base64-encoded PKCS#8 PEM private key',
    }),
  // Key id, put in every token header and in the JWKS, so keys can be rotated later.
  JWT_KEY_ID: z.string().min(1),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),
  // Sign-in attempts allowed per minute, per IP and per email (spec 002).
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
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
