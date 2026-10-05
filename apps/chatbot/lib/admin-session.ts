/**
 * Signed, expiring admin sessions: the cookie holds "<expiresAtMs>.<hmac>".
 * Uses Web Crypto so the same code runs in middleware (edge) and route handlers (nodejs).
 * Signing key: ADMIN_SESSION_SECRET if set, otherwise ADMIN_PASSWORD (changing it logs everyone out).
 */
export const ADMIN_COOKIE = 'admin-token';
export const ADMIN_SESSION_SECONDS = 60 * 60; // 1 hour

const encoder = new TextEncoder();

function signingKey(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)));
}

/** Constant-time string comparison (both inputs are fixed-length hex digests here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compares digests rather than raw strings so timing leaks neither content nor length. */
export async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return safeEqual(toHex(a), toHex(b));
}

export async function createAdminToken(now = Date.now()): Promise<string | null> {
  const key = signingKey();
  if (!key) return null;
  const expiresAt = now + ADMIN_SESSION_SECONDS * 1000;
  return `${expiresAt}.${await hmac(key, `admin:${expiresAt}`)}`;
}

export async function verifyAdminToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  const key = signingKey();
  if (!key || !token) return false;
  const [expires, signature] = token.split('.');
  const expiresAt = Number(expires);
  if (!signature || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  return safeEqual(signature, await hmac(key, `admin:${expiresAt}`));
}
