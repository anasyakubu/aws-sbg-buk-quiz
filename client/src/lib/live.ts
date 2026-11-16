import { API_ORIGIN, getToken } from './api';

/** HTTP + MongoDB live-quiz transport: safe across Vercel Function instances. */
const BASE = `${API_ORIGIN}/api/live`;
const createRequests = new Map<string, Promise<any>>();

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getToken();
  const abort = new AbortController();
  const timeout = window.setTimeout(() => abort.abort(), 12000);
  try {
    const response = await fetch(url, {
      method, cache: 'no-store', signal: abort.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Live quiz API returned HTTP ${response.status}`);
    window.dispatchEvent(new CustomEvent('live:connection', { detail: 'online' }));
    return data as T;
  } catch (error) {
    window.dispatchEvent(new CustomEvent('live:connection', { detail: 'reconnecting' }));
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export function createLiveGame(quizId: string) {
  const cached = createRequests.get(quizId);
  if (cached) return cached;
  // Single pending request also covers React StrictMode's mount/unmount/remount.
  const sessionStorageKey = `host-session:${quizId}`;
  let hostSessionKey = sessionStorage.getItem(sessionStorageKey);
  if (!hostSessionKey) { hostSessionKey = crypto.randomUUID(); sessionStorage.setItem(sessionStorageKey, hostSessionKey); }
  const promise = request<any>(`${BASE}/create`, 'POST', { quizId, hostSessionKey });
  createRequests.set(quizId, promise);
  promise.finally(() => createRequests.delete(quizId)).catch(() => {});
  return promise;
}
export function liveState<T = any>(pin: string, playerId?: string): Promise<T> {
  return request(`${BASE}/${encodeURIComponent(pin)}/state${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ''}`);
}
export function joinLive(pin: string, playerId: string, name: string) {
  return request<any>(`${BASE}/${encodeURIComponent(pin)}/join`, 'POST', { playerId, name });
}
export function answerLive(pin: string, playerId: string, questionIndex: number, answer: number[]) {
  return request<{ ok?: boolean; late?: boolean; duplicate?: boolean; error?: string }>(`${BASE}/${encodeURIComponent(pin)}/answer`, 'POST', { playerId, questionIndex, answer });
}
export function hostLive(pin: string, command: string, extra: object = {}) {
  return request<any>(`${BASE}/${encodeURIComponent(pin)}/host/${encodeURIComponent(command)}`, 'POST', extra);
}
