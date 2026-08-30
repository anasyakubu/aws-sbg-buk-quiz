import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';
import { registerGameHandlers } from './socket/game';

/**
 * Long-running server: REST API + Socket.IO.
 * Use this on a persistent host (Render / Railway / Fly / EC2). Live games need
 * an always-on process, so this entry point is what runs real quiz sessions.
 */
async function main() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.allowedOrigins },
    pingInterval: 10_000,
    pingTimeout: 20_000,     // tolerant of flaky connections
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });
  registerGameHandlers(io);

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
