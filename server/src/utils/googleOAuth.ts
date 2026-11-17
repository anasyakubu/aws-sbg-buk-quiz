import { randomBytes, timingSafeEqual } from 'node:crypto';

export const GOOGLE_COOKIE = 'sbg_google_oauth';
export const GOOGLE_COOKIE_PATH = '/api/auth/google/callback';
export type GoogleFrom = 'register' | 'login';

export function googleFrom(value: unknown): GoogleFrom {
  return value === 'register' ? 'register' : 'login';
}

export function newGoogleState(): string {
  return randomBytes(32).toString('hex');
}

// Store a random nonce in a first-party HttpOnly SameSite=Lax cookie. On Google's
// top-level GET callback the browser sends it, including from an installed PWA.
export function googleStateCookie(state: string, from: GoogleFrom): string {
  return `${state}.${from}`;
}

export function readCookie(header: string | undefined, key: string): string | undefined {
  for (const entry of (header || '').split(';')) {
    const i = entry.indexOf('=');
    if (i !== -1 && entry.slice(0, i).trim() === key) return entry.slice(i + 1).trim();
  }
  return undefined;
}

export function verifyGoogleState(queryState: unknown, cookieValue: string | undefined): GoogleFrom | null {
  if (typeof queryState !== 'string' || !cookieValue) return null;
  const [nonce, from] = cookieValue.split('.');
  if (!/^[a-f0-9]{64}$/.test(nonce) || !['register', 'login'].includes(from)) return null;
  const a = Buffer.from(queryState);
  const b = Buffer.from(nonce);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return from as GoogleFrom;
}
