import { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found.' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong on our side. Try again.' : err.message,
  });
}
