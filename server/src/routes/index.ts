import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as quiz from '../controllers/quiz.controller';
import * as ai from '../controllers/ai.controller';
import * as results from '../controllers/result.controller';
import authRoutes from './auth';
import live from './live';

const router = Router();

const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// ---- Account registration, password login, Google OAuth ----
router.use('/auth', authRoutes);

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

router.get('/health', (_req, res) => res.json({ ok: true, apiVersion: 'vercel-auth-v2', realtime: true, transport: 'http-polling', websocketRequired: false, ts: Date.now() }));

export default router;