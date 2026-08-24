/**
 * Cryptographic Password Hashing using Web Crypto API
 * Compatible with Cloudflare Workers runtime and standard browsers/Node.
 */

const ITERATIONS = 100_000;
const HASH_ALGO = 'SHA-512';
const KEY_LEN_BYTES = 64;

/**
 * Generate a cryptographically secure random hexadecimal salt.
 */
export function generateSalt(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/**
 * Convert ArrayBuffer or Uint8Array to hex string.
 */
function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a plain text password with a given salt using PBKDF2.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = hexToBytes(saltHex);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    passwordKey,
    KEY_LEN_BYTES * 8
  );

  return bytesToHex(derivedBits);
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify a plain text password against a stored salt and hash.
 */
export async function verifyPassword(
  plain: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  if (!plain || !storedHash || !storedSalt) {
    return false;
  }
  const calculatedHash = await hashPassword(plain, storedSalt);
  return constantTimeEqual(calculatedHash, storedHash);
}
