import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io('/', {
    auth: cb => cb({ token: getToken() }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,   // exponential backoff, capped
    timeout: 20000,
    transports: ['websocket', 'polling'], // polling fallback for restrictive networks
  });
  return socket;
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
