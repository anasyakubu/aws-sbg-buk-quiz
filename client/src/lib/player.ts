// Stable identity + answer persistence for unstable networks.

export function getPlayerId(): string {
  let id = localStorage.getItem('playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('playerId', id);
  }
  return id;
}

interface PendingAnswer { questionIndex: number; answer: number[]; ts: number; }

const key = (pin: string) => `pending-answer:${pin}`;

// Save BEFORE emitting — if the socket drops mid-send, the answer survives.
export function savePendingAnswer(pin: string, questionIndex: number, answer: number[]) {
  localStorage.setItem(key(pin), JSON.stringify({ questionIndex, answer, ts: Date.now() } satisfies PendingAnswer));
}
export function getPendingAnswer(pin: string): PendingAnswer | null {
  try { return JSON.parse(localStorage.getItem(key(pin)) || 'null'); } catch { return null; }
}
export function clearPendingAnswer(pin: string) { localStorage.removeItem(key(pin)); }
