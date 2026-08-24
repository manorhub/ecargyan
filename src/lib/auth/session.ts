/**
 * Secure Session Handling using Web Crypto HMAC-SHA256 Signed Tokens
 * Manages admin session creation, signature verification, and secure cookie headers.
 */

import { logWarn } from '../utils/logger';

export interface AdminSession {
  adminId: string;
  email: string;
  role: string;
  expiresAt: number;
}

const COOKIE_NAME = 'ec_admin_session';
const DEFAULT_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const FALLBACK_DEV_SECRET = 'ecargyan-dev-session-secret-change-in-production-min-32-chars';

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Generate a signed session string.
 */
export async function createSessionToken(
  session: Omit<AdminSession, 'expiresAt'>,
  secret?: string
): Promise<string> {
  const secretKey = secret || FALLBACK_DEV_SECRET;
  if (!secret) {
    logWarn('Using development fallback session secret. Ensure SESSION_SECRET is configured in production.');
  }

  const payload: AdminSession = {
    ...session,
    expiresAt: Date.now() + DEFAULT_SESSION_DURATION_MS,
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadString);

  const key = await getHmacKey(secretKey);
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload)
  );

  const encodedSignature = base64UrlEncode(
    Array.from(new Uint8Array(signatureBytes))
      .map((b) => String.fromCharCode(b))
      .join('')
  );

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify and decode a signed session token.
 */
export async function verifySessionToken(
  token: string,
  secret?: string
): Promise<AdminSession | null> {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const secretKey = secret || FALLBACK_DEV_SECRET;

  try {
    const key = await getHmacKey(secretKey);
    const rawSignature = base64UrlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(rawSignature.length);
    for (let i = 0; i < rawSignature.length; i++) {
      signatureBytes[i] = rawSignature.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as BufferSource,
      new TextEncoder().encode(encodedPayload)
    );

    if (!isValid) {
      return null;
    }

    const decodedString = base64UrlDecode(encodedPayload);
    const session = JSON.parse(decodedString) as AdminSession;

    // Check expiration
    if (Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Create a Set-Cookie header string for an admin session.
 */
export function createSessionCookie(token: string, isProduction: boolean = false): string {
  const maxAge = Math.floor(DEFAULT_SESSION_DURATION_MS / 1000);
  const secureFlag = isProduction ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureFlag}`;
}

/**
 * Create an expired Set-Cookie header to delete the session.
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Parse the admin session cookie from a Request.
 */
export function getSessionCookieFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${COOKIE_NAME}=`)) {
      return cookie.substring(COOKIE_NAME.length + 1);
    }
  }
  return null;
}
