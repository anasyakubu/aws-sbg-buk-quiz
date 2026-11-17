import { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4 does not forward rejected async handler promises to error middleware.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { Promise.resolve().then(() => fn(req, res, next)).catch(next); };
}
