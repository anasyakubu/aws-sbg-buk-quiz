import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { Server } from 'socket.io';
import { env } from './config/env';
import { connectDB } from './config/db';
import { configurePassport } from './config/passport';
import routes from './routes';
import { notFound, errorHandler } from './middleware/error';
import { registerGameHandlers } from './socket/game';

async function main() {
  await connectDB();
  configurePassport();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(compression()); // smaller payloads for slow campus networks
  app.use(express.json({ limit: '1mb' }));
  app.use(passport.initialize());
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: env.clientUrl },
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
