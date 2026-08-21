import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const N = 32_768;
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_BYTES, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$N=${N},r=${R},p=${P}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encodedHash) {
  try {
    const [algorithm, params, saltText, hashText] = String(encodedHash).split('$');
    if (algorithm !== 'scrypt' || params !== `N=${N},r=${R},p=${P}` || !saltText || !hashText) return false;

    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;

    const actual = Buffer.from(await scrypt(password, salt, KEY_BYTES, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
