import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { env } from './config/env';
import { configurePassport } from './config/passport';
import routes from './routes';
import { notFound, errorHandler } from './middleware/error';

/**
 * Builds the Express app. Kept separate from src/index.ts so the same app can be
 * mounted by a long-running Node server (with Socket.IO) or by a serverless
 * function on Vercel (REST only).
 */
export function createApp(): Express {
  configurePassport();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.allowedOrigins, credentials: true }));
  app.use(compression()); // smaller payloads for slow campus networks
  app.use(express.json({ limit: '1mb' }));
  app.use(passport.initialize());

  // NOTE: the in-memory store is per-instance. On Vercel each serverless
  // instance keeps its own counter, so this is a soft limit, not a hard one.
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
