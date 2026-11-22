// Creates an RS256 key pair for signing access tokens in local development and writes the
// private key (base64-encoded PKCS#8 PEM) and a key id into .env. Run: npm run jwt:keys
// Refuses to replace an existing key unless you pass --force, because a new key signs
// everyone out (old access tokens no longer verify).
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const envPath = join(root, '.env');
if (!existsSync(envPath)) {
  copyFileSync(join(root, '.env.example'), envPath);
  console.log('created .env from .env.example');
}

let env = readFileSync(envPath, 'utf8');
const current = env.match(/^JWT_PRIVATE_KEY=(.*)$/m)?.[1]?.trim();
if (current && !process.argv.includes('--force')) {
  console.log('.env already has a JWT_PRIVATE_KEY. Run with --force to replace it (signs everyone out).');
  process.exit(0);
}

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const values = {
  JWT_PRIVATE_KEY: Buffer.from(pem).toString('base64'),
  JWT_KEY_ID: `dev-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`,
};

for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}
writeFileSync(envPath, env);
console.log(`wrote JWT_PRIVATE_KEY and JWT_KEY_ID (${values.JWT_KEY_ID}) to .env`);
