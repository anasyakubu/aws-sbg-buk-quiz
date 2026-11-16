import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { env } from './config/env';
import { connectDB } from './config/db';
import { configurePassport } from './config/passport';
import routes from './routes';
import { notFound, errorHandler } from './middleware/error';

/**
 * Vercel detects src/app.ts as the Express function entry. This API uses
 * MongoDB-backed /api/live routes so no persistent Socket.IO server is required.
 * src/local.ts remains available for local long-running development.
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

  // NOTE: the in-memory store is per-instance. On Vercel each function
  // instance keeps its own counter, so this is a soft limit, not a hard one.
  app.use(rateLimit({
    windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false,
    // Many students can share one campus NAT IP. Read-only live state polling
    // must not exhaust the shared per-IP limit; writes stay rate-limited.
    skip: req => req.method === 'GET' && req.path.startsWith('/api/live/'),
  }));

  // Serverless: make sure the (cached) DB connection is ready before any route
  // runs. On a persistent host this resolves instantly after the first call.
  app.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error('[db] connection failed', err);
      next(Object.assign(new Error('Database unavailable. Please try again in a moment.'), { status: 503 }));
    }
  });

  app.get('/', (_req, res) => res.json({ name: 'SBG BUK Quiz API', health: '/api/health' }));
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
