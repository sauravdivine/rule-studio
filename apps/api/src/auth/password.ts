import { argon2id, hash, verify } from 'argon2';

// Argon2id with the library's defaults (OWASP's first choice for password hashing).
export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // a malformed hash counts as "wrong password"
  }
}

// Compared against when the email does not exist, so an unknown email takes as long as a
// wrong password. Otherwise the response time would reveal which emails have accounts.
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword('not-a-real-password');
  return dummyHash;
}
