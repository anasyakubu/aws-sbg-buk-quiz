// Empty in dev: Vite proxies /api to the local server (see vite.config.ts).
// In production set VITE_API_URL to the deployed API origin, e.g.
// https://sbg-buk-quiz-api.vercel.app
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

export function getToken(): string | null { return localStorage.getItem('token'); }
export function setToken(t: string | null) { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); }

async function withRetry(fn: () => Promise<Response>, retries = 2): Promise<Response> {
  // Retry idempotent-ish failures on flaky campus networks
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (err) {
      if (i >= retries || !navigator.onLine) throw err;
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const doFetch = () => fetch(`${BASE}${path}`, { ...options, headers });
  const res = await (retry && (!options.method || options.method === 'GET') ? withRetry(doFetch) : doFetch());
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && getToken()) { setToken(null); localStorage.removeItem('user'); }
    throw new Error(data?.error || 'Request failed. Check your connection and try again.');
  }
  return data as T;
}
