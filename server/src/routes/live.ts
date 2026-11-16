import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { randomInt } from 'crypto';
import { LiveGame, ILiveGame } from '../models/LiveGame';
import { LivePlayer, ILivePlayer } from '../models/LivePlayer';
import { Quiz, IQuestion } from '../models/Quiz';
import { GameResult } from '../models/GameResult';
import { requireAuth } from '../middleware/auth';
import { verifyToken } from '../utils/jwt';

/**
 * Serverless-safe realtime transport for two Vercel deployments.
 * The browser reads small state snapshots roughly every 1.5 seconds; commands and
 * answers are ordinary POSTs. All state and deadlines live in MongoDB.
 * No sticky sessions, Socket.IO path, timers, or extra Redis service required.
 */
const router = Router();
const VALID_PIN = /^\d{6}$/;
const VALID_PLAYER = /^[a-f0-9-]{32,48}$/i;
const ACTIVE_MS = 16000;
const MAX_LIFE_MS = 24 * 60 * 60 * 1000;
const respondError = (res: Response, error: string, status = 400) => res.status(status).json({ error });
const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;
const asyncHandler = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req, res)).catch(next);

function publicQuestion(q: IQuestion, index: number, total: number) {
  return { index, total, type: q.type, text: q.text, code: q.code, language: q.language,
    imageUrl: q.imageUrl, options: q.options, timeLimit: q.timeLimit, multi: q.type === 'multiple_answer' };
}
function validHost(req: Request, game: ILiveGame) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;
  try { return verifyToken(authorization.slice(7)).sub === String(game.hostUserId); }
  catch { return false; }
}
function playerSummary(p: ILivePlayer) {
  return { playerId: p.playerId, name: p.name, score: p.score, connected: Date.now() - p.lastSeenAt <= ACTIVE_MS };
}
function leaderboard(players: ILivePlayer[], limit = 10) {
  return [...players].sort((a, b) => b.score - a.score).slice(0, limit).map((p, i) => ({
    rank: i + 1, playerId: p.playerId, name: p.name, score: p.score,
    correct: p.correct, streak: p.streak, connected: Date.now() - p.lastSeenAt <= ACTIVE_MS,
  }));
}
function state(game: ILiveGame, players: ILivePlayer[]) {
  return { pin: game.pin, quizTitle: game.quizTitle, status: game.status,
    currentIndex: game.currentIndex, totalQuestions: game.questions.length,
    players: players.map(playerSummary) };
}
function scoreAnswer(q: IQuestion, answer: number[], elapsedMs: number, streak: number) {
  const expected = new Set(q.correctIndexes);
  const correct = expected.size === answer.length && answer.every(a => expected.has(a));
  if (!correct) return { correct: false, points: 0 };
  const factor = Math.max(0, 1 - elapsedMs / (q.timeLimit * 1000));
  const base = q.points ?? 1000;
  return { correct: true, points: Math.round(base * (0.5 + 0.5 * factor)) + Math.min(streak, 5) * 50 };
}
function questionSummary(game: ILiveGame, players: ILivePlayer[]) {
  const i = game.currentIndex;
  const responses = players.flatMap(p => p.answers.filter(a => a.questionIndex === i));
  const sum = responses.reduce((n, a) => n + a.ms, 0);
  return { questionIndex: i, correctIndexes: game.questions[i].correctIndexes,
    explanation: game.questions[i].explanation,
    stats: { answered: responses.length, correct: responses.filter(a => a.correct).length,
      avgMs: responses.length ? Math.round(sum / responses.length) : 0 },
    isLast: i === game.questions.length - 1 };
}
function privateResult(game: ILiveGame, player: ILivePlayer, players: ILivePlayer[]) {
  const q = game.questions[game.currentIndex];
  const ans = player.answers.find(a => a.questionIndex === game.currentIndex);
  return { questionIndex: game.currentIndex, answered: Boolean(ans),
    correct: ans?.correct ?? false, points: ans?.points ?? 0,
    score: player.score, streak: player.streak,
    correctIndexes: q.correctIndexes, explanation: q.explanation,
    rank: leaderboard(players, players.length).find(p => p.playerId === player.playerId)?.rank ?? null };
}
async function findGame(pin: string) {
  if (!VALID_PIN.test(pin)) return null;
  const game = await LiveGame.findOne({ pin, expiresAt: { $gt: new Date() } }).lean();
  if (!game) return null;
  // A timed-out question is revealed by the first subsequent state read/command.
  // Conditional update prevents competing Vercel instances from undoing transitions.
  if (game.status === 'question' && Date.now() >= game.questionDeadline) {
    const result = await LiveGame.findOneAndUpdate(
      { pin, status: 'question', questionDeadline: { $lte: Date.now() } },
      { $set: { status: 'reveal' } }, { new: true }).lean();
    return result ?? await LiveGame.findOne({ pin }).lean();
  }
  return game;
}
async function getPlayers(pin: string) {
  return LivePlayer.find({ pin, banned: false }).lean();
}
function activeQuestion(game: ILiveGame, player?: ILivePlayer) {
  const q = game.questions[game.currentIndex];
  if (!q) return undefined;
  return { question: publicQuestion(q, game.currentIndex, game.questions.length),
    deadline: game.questionDeadline, serverNow: Date.now(),
    ...(player ? { alreadyAnswered: player.answers.some(a => a.questionIndex === game.currentIndex) } : {}) };
}
async function finishGame(game: ILiveGame) {
  const players = await getPlayers(game.pin);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const finalPlayers = sorted.map((p, i) => {
    const answered = p.answers.length;
    return { playerId: p.playerId, userId: p.userId, name: p.name, score: p.score,
      correct: p.correct, answered, accuracy: answered ? Math.round(p.correct / answered * 100) : 0,
      avgMs: answered ? Math.round(p.answers.reduce((a, b) => a + b.ms, 0) / answered) : 0,
      bestStreak: p.bestStreak, rank: i + 1 };
  });
  const finale = { quizTitle: game.quizTitle, podium: finalPlayers.slice(0, 3),
    leaderboard: finalPlayers.slice(0, 10), totalPlayers: finalPlayers.length };
  const modified = await LiveGame.findOneAndUpdate({ pin: game.pin, status: { $ne: 'ended' } },
    { $set: { status: 'ended', finalResult: finale } }, { new: true }).lean();
  if (!modified) return; // only one concurrent invocation records the result
  const questionStats = game.questions.map((q, i) => {
    const answers = players.flatMap(p => p.answers.filter(a => a.questionIndex === i));
    return { index: i, text: q.text, answeredCount: answers.length,
      correctCount: answers.filter(a => a.correct).length,
      avgMs: answers.length ? Math.round(answers.reduce((n, a) => n + a.ms, 0) / answers.length) : 0 };
  });
  try {
    await GameResult.create({ quiz: game.quizId, quizTitle: game.quizTitle,
      host: game.hostUserId, pin: game.pin, startedAt: new Date(game.startedAt || Date.now()),
      endedAt: new Date(), players: finalPlayers, questionStats });
  } catch (e) { console.error('[live] Could not save game report:', e); }
}

router.post('/create', requireAuth, asyncHandler(async (req, res) => {
  const { quizId, hostSessionKey } = req.body || {};
  if (!mongoose.isValidObjectId(quizId)) return respondError(res, 'Invalid quiz ID.');
  const quiz = await Quiz.findOne({ _id: quizId, owner: req.user!._id }).lean();
  if (!quiz) return respondError(res, 'Quiz not found.', 404);
  if (!quiz.questions.length) return respondError(res, 'Add at least one question before hosting.');
  const safeSessionKey = typeof hostSessionKey === 'string' && VALID_PLAYER.test(hostSessionKey) ? hostSessionKey : undefined;
  if (safeSessionKey) {
    const existing = await LiveGame.findOne({ hostUserId: req.user!._id, hostSessionKey: safeSessionKey, expiresAt: { $gt: new Date() } }).lean();
    if (existing) return res.json({ pin: existing.pin, quizTitle: existing.quizTitle, totalQuestions: existing.questions.length });
  }
  if (quiz.questions.some(q => !['multiple_choice', 'true_false', 'multiple_answer', 'code_output', 'image'].includes(q.type))) {
    return respondError(res, 'Unsupported question type. Use multiple choice, true/false, multiple answer, image or code output.');
  }
  for (let i = 0; i < 8; i++) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await LiveGame.create({ pin, quizId: quiz._id, quizTitle: quiz.title,
        hostUserId: req.user!._id, hostSessionKey: safeSessionKey, questions: quiz.questions, status: 'lobby', currentIndex: -1,
        questionStartedAt: 0, questionDeadline: 0, remainingOnPause: 0, startedAt: 0,
        expiresAt: new Date(Date.now() + MAX_LIFE_MS) });
      return res.status(201).json({ pin, quizTitle: quiz.title, totalQuestions: quiz.questions.length });
    } catch (e) {
      if (!isDuplicate(e)) throw e;
      if (safeSessionKey) {
        const existing = await LiveGame.findOne({ hostUserId: req.user!._id, hostSessionKey: safeSessionKey }).lean();
        if (existing) return res.json({ pin: existing.pin, quizTitle: existing.quizTitle, totalQuestions: existing.questions.length });
      }
    }
  }
  return respondError(res, 'Could not reserve a unique game PIN. Please retry.', 503);
}));

router.get('/:pin/state', asyncHandler(async (req, res) => {
  const pin = String(req.params.pin);
  const game = await findGame(pin);
  if (!game) return respondError(res, 'Game not found or expired.', 404);
  const playerId = String(req.query.playerId || '');
  if (!playerId) {
    if (!validHost(req, game)) return respondError(res, 'Sign in as the game host.', 403);
    const players = await getPlayers(pin);
    const responses = players.filter(p => p.answers.some(a => a.questionIndex === game.currentIndex));
    return res.json({ state: state(game, players), leaderboard: leaderboard(players),
      answered: { answered: game.currentIndex < 0 ? 0 : responses.length, total: players.length },
      activeQuestion: game.currentIndex >= 0 ? activeQuestion(game) : undefined,
      reveal: game.status === 'reveal' ? questionSummary(game, players) : undefined,
      finale: game.finalResult, serverNow: Date.now() });
  }
  if (!VALID_PLAYER.test(playerId)) return respondError(res, 'Invalid player ID.');
  const player = await LivePlayer.findOne({ pin, playerId }).lean();
  if (!player) return respondError(res, 'Join this game first.', 404);
  if (player.banned) return res.json({ kicked: true });
  if (Date.now() - player.lastSeenAt > 9000) {
    await LivePlayer.updateOne({ pin, playerId, banned: false }, { $set: { lastSeenAt: Date.now() } });
    player.lastSeenAt = Date.now();
  }
  // Do not send every participant's details to every phone on each poll.
  const players = game.status === 'reveal' ? await getPlayers(pin) : [];
  const playerCount = game.status === 'reveal' ? players.length : await LivePlayer.countDocuments({ pin, banned: false });
  return res.json({ state: { pin, quizTitle: game.quizTitle, status: game.status,
    currentIndex: game.currentIndex, totalQuestions: game.questions.length, playerCount },
    you: { name: player.name, score: player.score, streak: player.streak },
    activeQuestion: (game.status === 'question' || game.status === 'paused') ? activeQuestion(game, player) : undefined,
    revealedResult: game.status === 'reveal' ? privateResult(game, player, players) : undefined,
    finale: game.finalResult, serverNow: Date.now() });
}));

router.post('/:pin/join', asyncHandler(async (req, res) => {
  const pin = String(req.params.pin);
  const { playerId, name } = req.body || {};
  if (!VALID_PLAYER.test(playerId || '')) return respondError(res, 'Invalid player ID. Refresh and retry.');
  const game = await findGame(pin);
  if (!game) return respondError(res, 'That game PIN was not found.', 404);
  const existing = await LivePlayer.findOne({ pin, playerId }).lean();
  if (existing?.banned) return respondError(res, 'You were removed from this game.', 403);
  if (!existing) {
    if (game.status !== 'lobby') return respondError(res, 'This game has already started.');
    const cleanName = String(name || '').trim().slice(0, 24);
    if (!cleanName) return respondError(res, 'Enter a nickname to join.');
    // Case-insensitive nickname uniqueness is enforced through the game documents' lookup.
    const all = await getPlayers(pin);
    if (all.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) return respondError(res, 'Nickname taken. Pick another.');
    let userId: mongoose.Types.ObjectId | undefined;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try { userId = new mongoose.Types.ObjectId(verifyToken(req.headers.authorization.slice(7)).sub); }
      catch { /* joining anonymously is allowed */ }
    }
    try {
      await LivePlayer.create({ pin, playerId, name: cleanName, nameKey: cleanName.toLowerCase(), userId, score: 0, streak: 0,
        bestStreak: 0, correct: 0, answers: [], banned: false,
        lastSeenAt: Date.now(), expiresAt: game.expiresAt });
    } catch (e) {
      if (!isDuplicate(e)) throw e;
      // A concurrently-created same-name player must not silently be treated as us.
      const samePlayer = await LivePlayer.findOne({ pin, playerId }).lean();
      if (!samePlayer) return respondError(res, 'That nickname was just taken. Pick another.', 409);
    }
  } else {
    await LivePlayer.updateOne({ pin, playerId }, { $set: { lastSeenAt: Date.now() } });
  }
  return res.json({ ok: true });
}));

router.post('/:pin/answer', asyncHandler(async (req, res) => {
  const pin = String(req.params.pin);
  const { playerId, questionIndex, answer } = req.body || {};
  const game = await findGame(pin);
  const player = VALID_PLAYER.test(playerId || '') ? await LivePlayer.findOne({ pin, playerId, banned: false }).lean() : null;
  if (!game || !player) return respondError(res, 'You are not in this game.', 403);
  // Duplicate answer retries should acknowledge success even after a question auto-reveals.
  if (player.answers.some(a => a.questionIndex === questionIndex)) return res.json({ ok: true, duplicate: true });
  if (game.status !== 'question' || questionIndex !== game.currentIndex || Date.now() > game.questionDeadline) {
    return res.json({ error: 'stale', late: true });
  }
  const q = game.questions[game.currentIndex];
  if (!Array.isArray(answer) || answer.length < 1 || answer.length > q.options.length ||
      (q.type !== 'multiple_answer' && answer.length !== 1) ||
      new Set(answer).size !== answer.length || answer.some(i => !Number.isInteger(i) || i < 0 || i >= q.options.length)) {
    return respondError(res, 'Invalid answer.');
  }
  const ms = Math.max(0, Math.min(Date.now() - game.questionStartedAt, q.timeLimit * 1000));
  const score = scoreAnswer(q, answer, ms, player.streak);
  const nextStreak = score.correct ? player.streak + 1 : 0;
  // One player document per participant avoids the cross-instance lost-update
  // issue of mutating a shared, in-memory room or replacing a whole room doc.
  const update = await LivePlayer.updateOne({ pin, playerId, banned: false, 'answers.questionIndex': { $ne: questionIndex } }, {
    $push: { answers: { questionIndex, answer, ms, correct: score.correct, points: score.points } },
    $inc: { score: score.points, correct: score.correct ? 1 : 0 },
    $set: { streak: nextStreak, lastSeenAt: Date.now() },
    $max: { bestStreak: nextStreak },
  });
  if (!update.modifiedCount) return res.json({ ok: true, duplicate: true });
  // Early reveal if every current participant answered; deadline is authoritative otherwise.
  const [total, answered] = await Promise.all([
    LivePlayer.countDocuments({ pin, banned: false }),
    LivePlayer.countDocuments({ pin, banned: false, 'answers.questionIndex': questionIndex }),
  ]);
  if (total > 0 && answered >= total) {
    await LiveGame.updateOne({ pin, status: 'question', currentIndex: questionIndex }, { $set: { status: 'reveal' } });
  }
  return res.json({ ok: true });
}));

router.post('/:pin/host/:command', asyncHandler(async (req, res) => {
  const pin = String(req.params.pin);
  const command = String(req.params.command);
  const game = await findGame(pin);
  if (!game) return respondError(res, 'Game not found or expired.', 404);
  if (!validHost(req, game)) return respondError(res, 'Only the signed-in host can control this quiz.', 403);
  const now = Date.now();
  if (command === 'kick') {
    const playerId = String(req.body?.playerId || '');
    const update = await LivePlayer.updateOne({ pin, playerId, banned: false }, { $set: { banned: true } });
    if (!update.modifiedCount) return respondError(res, 'Player not found.', 404);
    return res.json({ ok: true });
  }
  if (command === 'end') {
    await finishGame(game);
    return res.json({ ok: true, ended: true });
  }
  if (command === 'start') {
    if (game.status !== 'lobby') return respondError(res, 'Game already started.');
    if (!(await LivePlayer.exists({ pin, banned: false }))) return respondError(res, 'Wait for at least one player to join.');
    const q = game.questions[0];
    const result = await LiveGame.updateOne({ pin, status: 'lobby' },
      { $set: { status: 'question', currentIndex: 0, startedAt: now,
        questionStartedAt: now, questionDeadline: now + q.timeLimit * 1000 } });
    return result.modifiedCount ? res.json({ ok: true }) : respondError(res, 'Game already started.', 409);
  }
  if (command === 'skip') {
    if (game.status !== 'question') return respondError(res, 'No active question.');
    await LiveGame.updateOne({ pin, status: 'question' }, { $set: { status: 'reveal' } });
    return res.json({ ok: true });
  }
  if (command === 'pause') {
    if (game.status !== 'question') return respondError(res, 'No active question to pause.');
    const result = await LiveGame.updateOne({ pin, status: 'question' },
      { $set: { status: 'paused', remainingOnPause: Math.max(0, game.questionDeadline - now) } });
    return result.modifiedCount ? res.json({ ok: true }) : respondError(res, 'Question already ended.', 409);
  }
  if (command === 'resume') {
    if (game.status !== 'paused') return respondError(res, 'Game is not paused.');
    const elapsed = game.questions[game.currentIndex].timeLimit * 1000 - game.remainingOnPause;
    await LiveGame.updateOne({ pin, status: 'paused' }, { $set: {
      status: 'question', questionStartedAt: now - elapsed, questionDeadline: now + game.remainingOnPause,
    } });
    return res.json({ ok: true });
  }
  if (command === 'next') {
    if (game.status !== 'reveal') return respondError(res, 'Finish the current question first.');
    const i = game.currentIndex + 1;
    if (i >= game.questions.length) { await finishGame(game); return res.json({ ok: true, ended: true }); }
    const q = game.questions[i];
    const result = await LiveGame.updateOne({ pin, status: 'reveal', currentIndex: i - 1 }, { $set: {
      status: 'question', currentIndex: i, questionStartedAt: now, questionDeadline: now + q.timeLimit * 1000,
      remainingOnPause: 0,
    } });
    return result.modifiedCount ? res.json({ ok: true }) : respondError(res, 'Question already advanced.', 409);
  }
  return respondError(res, 'Unknown host command.', 404);
}));

export default router;
