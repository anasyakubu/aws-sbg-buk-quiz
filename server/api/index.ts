import type { IncomingMessage, ServerResponse } from 'http';
import { connectDB } from '../src/config/db';
import { createApp } from '../src/app';

// Built once per cold start, then reused by every warm invocation.
const app = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connection failed', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable. Please try again in a moment.' }));
    return;
  }

  // Express instances are plain (req, res) handlers.
  return (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
}
