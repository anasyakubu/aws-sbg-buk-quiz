import { io, Socket } from 'socket.io-client';
import { getToken, API_ORIGIN } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_ORIGIN || '/', {
    auth: cb => cb({ token: getToken() }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 8000,
    timeout: 12000,
    // A single persistent Node server supports both transports. Prefer
    // polling so restricted campus networks can still establish a connection.
    transports: ['polling', 'websocket'],
    upgrade: true,
  });
  return socket;
}

/** Acknowledge a game command, without leaving the UI spinning indefinitely. */
export async function socketAck<T = any>(event: string, payload: unknown, timeoutMs = 12000): Promise<T> {
  const s = getSocket();
  if (!s.connected) {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Live server unavailable. Check your connection or contact the quiz host.')); }, timeoutMs);
      const connected = () => { cleanup(); resolve(); };
      const cleanup = () => { window.clearTimeout(timeout); s.off('connect', connected); };
      s.on('connect', connected);
      s.connect();
    });
  }
  return new Promise<T>((resolve, reject) => {
    s.timeout(timeoutMs).emit(event, payload, (err: Error | null, result: T) => {
      if (err) reject(new Error('The live server did not respond. Please try again.'));
      else resolve(result);
    });
  });
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
