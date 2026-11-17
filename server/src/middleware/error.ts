import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response) {
  const apiRequest = req.path.startsWith('/api');
  res.status(404).json({
    error: apiRequest
      ? 'API endpoint not found. Check that the updated server/ directory is deployed as the Vercel API project.'
      : 'Not found.',
  });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return _next(err);
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
  }
  const status = Number(err?.status || err?.statusCode || 500);
  if (status >= 500) console.error('[error]', err);
  return res.status(status >= 400 && status <= 599 ? status : 500).json({
    error: status >= 500 ? 'The server could not complete your request. Please try again.' : (err?.message || 'Invalid request.'),
  });
}
