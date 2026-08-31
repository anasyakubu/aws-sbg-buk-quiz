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
 * Builds the Express app. The default export at the bottom is what Vercel's
 * Express preset picks up (it looks for src/app.ts exporting the app). The
 * long-running server in src/index.ts imports the same app and adds Socket.IO.
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
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

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
