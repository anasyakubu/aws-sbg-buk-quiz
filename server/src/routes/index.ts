import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import * as quiz from '../controllers/quiz.controller';
import * as ai from '../controllers/ai.controller';
import * as results from '../controllers/result.controller';
import { signToken } from '../utils/jwt';
import { env } from '../config/env';
import live from './live';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// ---- Auth ----
router.post('/auth/register', authLimiter, validate(auth.registerSchema), auth.register);
router.post('/auth/login', authLimiter, validate(auth.loginSchema), auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/profile', requireAuth, validate(auth.profileSchema), auth.updateProfile);
router.post('/auth/change-password', requireAuth, validate(auth.passwordSchema), auth.changePassword);

// ---- Google OAuth ----
router.get('/auth/google', (req, res, next) => {
  if (!env.google.clientId) return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.clientUrl}/login?error=google` }),
  (req, res) => {
    const user = req.user as { id: string; role: string };
    const token = signToken({ sub: user.id, role: user.role });
    res.redirect(`${env.clientUrl}/oauth/callback?token=${token}`);
  }
);

// ---- Quizzes ----
router.get('/quizzes', requireAuth, quiz.listQuizzes);
router.post('/quizzes', requireAuth, validate(quiz.quizSchema), quiz.createQuiz);
router.get('/quizzes/categories', requireAuth, quiz.categories);
router.get('/quizzes/:id', requireAuth, quiz.getQuiz);
router.put('/quizzes/:id', requireAuth, validate(quiz.quizSchema), quiz.updateQuiz);
router.delete('/quizzes/:id', requireAuth, quiz.deleteQuiz);

// ---- AI ----
router.get('/ai/providers', requireAuth, ai.providers);
router.post('/ai/generate', requireAuth, aiLimiter, validate(ai.generateSchema), ai.generate);

// ---- Vercel-compatible live quiz (database-backed, HTTP state updates) ----
router.use('/live', live);

// ---- Results / history ----
router.get('/results/hosted', requireAuth, results.hostedGames);
router.get('/results/history', requireAuth, results.myHistory);
router.get('/results/:id', requireAuth, results.gameDetail);

router.get('/health', (req, res) => res.json({ ok: true, realtime: true, transport: 'http-polling', websocketRequired: false, ts: Date.now() }));

export default router;