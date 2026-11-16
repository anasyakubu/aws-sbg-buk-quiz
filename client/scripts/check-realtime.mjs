// Usage: npm run check:realtime -- https://your-api.example.com
import { io } from 'socket.io-client';

const origin = process.argv[2]?.replace(/\/$/, '');
if (!origin || !/^https?:\/\//.test(origin)) {
  console.error('Usage: npm run check:realtime -- https://your-backend-domain');
  process.exit(2);
}

const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(12000) });
const data = await health.json();
if (!health.ok || data.ok !== true || data.realtime !== true) {
  throw new Error(`The API is not running the real-time Node server: ${JSON.stringify(data)}`);
}
console.log('OK: API health check confirms realtime is enabled');

const socket = io(origin, { transports: ['websocket'], timeout: 10000, reconnection: false });
try {
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', err => reject(new Error(`Socket.IO connection failed: ${err.message}`)));
    setTimeout(() => reject(new Error('WebSocket handshake timed out')), 12000);
  });
  console.log('OK: Socket.IO WebSocket connected');
  const result = await new Promise((resolve, reject) => {
    socket.timeout(5000).emit('host:rejoin', { pin: '000000' }, (err, response) => {
      if (err) reject(new Error('Socket.IO event acknowledgement timed out'));
      else resolve(response);
    });
  });
  if (!result || result.error !== 'Game not found.') throw new Error(`Unexpected response: ${JSON.stringify(result)}`);
  console.log('OK: Live-game event handler responded — backend is correctly deployed');
} finally { socket.disconnect(); }
