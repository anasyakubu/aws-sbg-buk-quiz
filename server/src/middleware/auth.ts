import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';

/**
 * `Express.Request` already carries `user?: IUser` thanks to the global
 * augmentation in src/types/express.d.ts, so this is just a readable alias.
 * Kept as a named export so controllers don't have to change.
 */
export type AuthRequest = Request;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Sign in to continue.' });
    }
    const payload = verifyToken(header.slice(7));
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account not found. Sign in again.' });
    req.user = user as Express.User;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this action.' });
    }
    next();
  };
}
