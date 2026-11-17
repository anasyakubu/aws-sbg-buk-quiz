import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import { signToken } from '../utils/jwt';
import { env } from '../config/env';
import { googleConfigured } from '../config/passport';
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, googleFrom, googleStateCookie,
  newGoogleState, readCookie, verifyGoogleState } from '../utils/googleOAuth';

const router = Router();

// Shared campus IPs must not lock every student out. The per-instance limiter
// is a soft safeguard on Vercel, not a substitute for account abuse protection.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 180,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
});

router.get('/providers', (_req, res) => res.json({
  ok: true, authVersion: 'auth-v2',
  emailPassword: true,
  google: googleConfigured && (env.nodeEnv !== 'production' || Boolean(env.serverUrl)),
}));

router.post('/register', authLimiter, validate(auth.registerSchema), asyncHandler(auth.register));
router.post('/login', authLimiter, validate(auth.loginSchema), asyncHandler(auth.login));
router.get('/me', requireAuth, asyncHandler(auth.me));
router.patch('/profile', requireAuth, validate(auth.profileSchema), asyncHandler(auth.updateProfile));
router.post('/change-password', requireAuth, validate(auth.passwordSchema), asyncHandler(auth.changePassword));

function errorRedirect(from: string, code: string) {
  return `${env.clientUrl}/${from === 'register' ? 'register' : 'login'}?error=${encodeURIComponent(code)}`;
}

const oauthCookieOptions = {
  httpOnly: true, sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  path: GOOGLE_COOKIE_PATH,
  maxAge: 10 * 60 * 1000,
};

router.get('/google', (req, res, next) => {
  const from = googleFrom(req.query.from);
  if (!googleConfigured || (env.nodeEnv === 'production' && !env.serverUrl)) {
    return res.redirect(303, errorRedirect(from, 'google_not_configured'));
  }
  const state = newGoogleState();
  res.cookie(GOOGLE_COOKIE, googleStateCookie(state, from), oauthCookieOptions);
  passport.authenticate('google', {
    scope: ['profile', 'email'], session: false, state,
  })(req, res, next);
});

router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  const saved = readCookie(req.headers.cookie, GOOGLE_COOKIE);
  const origin = saved?.endsWith('.register') ? 'register' : 'login';
  res.clearCookie(GOOGLE_COOKIE, { path: GOOGLE_COOKIE_PATH, sameSite: 'lax',
    secure: env.nodeEnv === 'production', httpOnly: true });
  const verifiedFrom = verifyGoogleState(req.query.state, saved);
  if (!verifiedFrom) return res.redirect(303, errorRedirect(origin, 'google_state'));
  if (req.query.error) return res.redirect(303, errorRedirect(verifiedFrom, 'google_cancelled'));
  if (!googleConfigured) return res.redirect(303, errorRedirect(verifiedFrom, 'google_not_configured'));

  passport.authenticate('google', { session: false },
    (err: Error | null, user: Express.User | false | null) => {
      if (err || !user) {
        if (err) console.error('[auth] Google callback failed:', err.message);
        return res.redirect(303, errorRedirect(verifiedFrom, 'google_failed'));
      }
      try {
        const token = signToken({ sub: user.id, role: user.role });
        // A URL fragment is not sent to the frontend host in an HTTP request,
        // unlike a query-string token, and the callback immediately erases it.
        res.setHeader('Cache-Control', 'no-store');
        return res.redirect(303, `${env.clientUrl}/oauth/callback#token=${encodeURIComponent(token)}`);
      } catch (error) {
        return next(error);
      }
    })(req, res, next);
});

export default router;
