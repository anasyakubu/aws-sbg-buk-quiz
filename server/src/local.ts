import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';
import { registerGameHandlers } from './socket/game';

/**
 * Optional local Node server: HTTP API + legacy Socket.IO handlers.
 * The Vercel frontend uses the durable MongoDB-backed /api/live routes instead.
 * This file is intentionally NOT a Vercel auto-detected entry point.
 */
async function main() {
  await connectDB();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.allowedOrigins },
    pingInterval: 10_000,
    pingTimeout: 20_000,     // tolerant of flaky connections
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });
  registerGameHandlers(io);
  // Expose whether this deployment actually runs the Socket.IO game engine.
  app.locals.realtimeEnabled = true;

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
