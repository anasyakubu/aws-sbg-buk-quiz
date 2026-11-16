import { Server, Socket } from 'socket.io';
import { customAlphabet } from 'nanoid';
import { Quiz, IQuestion } from '../models/Quiz';
import { GameResult } from '../models/GameResult';
import { verifyToken } from '../utils/jwt';

const pinGen = customAlphabet('0123456789', 6);
const DISCONNECT_GRACE_MS = 45_000;

interface PlayerAnswer {
  questionIndex: number;
  answer: number[];       // selected option indexes
  ms: number;             // response time
  correct: boolean;
  points: number;
}

interface Player {
  playerId: string;       // stable client-generated id (survives reconnects)
  socketId: string | null;
  userId?: string;
  name: string;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  answers: PlayerAnswer[];
  connected: boolean;
  disconnectTimer?: NodeJS.Timeout;
}

type GameStatus = 'lobby' | 'question' | 'reveal' | 'paused' | 'ended';

interface Game {
  pin: string;
  quizId: string;
  quizTitle: string;
  hostUserId: string;
  hostSocketId: string | null;
  questions: IQuestion[];
  status: GameStatus;
  currentIndex: number;         // -1 in lobby
  questionStartedAt: number;
  questionDeadline: number;
  remainingOnPause: number;     // ms left when paused
  timer?: NodeJS.Timeout;
  players: Map<string, Player>;
  startedAt: number;
  perQuestionMs: Map<number, number[]>; // response times for analytics
  bannedPlayers: Set<string>;
  finalResult?: { quizTitle: string; podium: unknown[]; leaderboard: unknown[]; totalPlayers: number };
}

const games = new Map<string, Game>();

// ---------- helpers ----------

const room = (pin: string) => `game:${pin}`;
const hostRoom = (pin: string) => `host:${pin}`;

function publicQuestion(q: IQuestion, index: number, total: number) {
  return {
    index, total,
    type: q.type,
    text: q.text,
    code: q.code,
    language: q.language,
    imageUrl: q.imageUrl,
    options: q.options,
    timeLimit: q.timeLimit,
    multi: q.type === 'multiple_answer',
  };
}

function leaderboard(game: Game, limit = 10) {
  return [...game.players.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1, playerId: p.playerId, name: p.name,
      score: p.score, correct: p.correct, streak: p.streak, connected: p.connected,
    }));
}

function lobbyState(game: Game) {
  return {
    pin: game.pin,
    quizTitle: game.quizTitle,
    status: game.status,
    currentIndex: game.currentIndex,
    totalQuestions: game.questions.length,
    players: [...game.players.values()].map(p => ({
      playerId: p.playerId, name: p.name, score: p.score, connected: p.connected,
    })),
  };
}

function scoreAnswer(q: IQuestion, answer: number[], ms: number, streak: number) {
  const correctSet = new Set(q.correctIndexes);
  const correct =
    answer.length === correctSet.size && answer.every(i => correctSet.has(i));
  if (!correct) return { correct: false, points: 0 };
  const timeLimitMs = q.timeLimit * 1000;
  const speedFactor = Math.max(0, 1 - ms / timeLimitMs); // 1 = instant, 0 = at deadline
  const base = q.points ?? 1000;
  const points = Math.round(base * 0.5 + base * 0.5 * speedFactor) + Math.min(streak, 5) * 50;
  return { correct: true, points };
}

// ---------- question lifecycle ----------

function startQuestion(io: Server, game: Game, index: number) {
  const q = game.questions[index];
  game.status = 'question';
  game.currentIndex = index;
  game.questionStartedAt = Date.now();
  game.questionDeadline = game.questionStartedAt + q.timeLimit * 1000;
  clearTimeout(game.timer);
  game.timer = setTimeout(() => endQuestion(io, game), q.timeLimit * 1000);

  io.to(room(game.pin)).emit('question:show', {
    question: publicQuestion(q, index, game.questions.length),
    deadline: game.questionDeadline,
    serverNow: Date.now(), // lets clients correct for clock skew
  });
  io.to(hostRoom(game.pin)).emit('host:answer-count', { answered: 0, total: connectedPlayers(game) });
}

function connectedPlayers(game: Game): number {
  return [...game.players.values()].filter(p => p.connected).length;
}

function questionSummary(game: Game) {
  const q = game.questions[game.currentIndex];
  const times = game.perQuestionMs.get(game.currentIndex) || [];
  return {
    questionIndex: game.currentIndex,
    correctIndexes: q.correctIndexes,
    explanation: q.explanation,
    stats: {
      answered: times.length,
      correct: [...game.players.values()].filter(p =>
        p.answers.some(a => a.questionIndex === game.currentIndex && a.correct)).length,
      avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    },
    isLast: game.currentIndex >= game.questions.length - 1,
  };
}

function privateResult(game: Game, player: Player) {
  const q = game.questions[game.currentIndex];
  const ans = player.answers.find(a => a.questionIndex === game.currentIndex);
  return {
    questionIndex: game.currentIndex,
    answered: Boolean(ans),
    correct: ans?.correct ?? false,
    points: ans?.points ?? 0,
    score: player.score,
    streak: player.streak,
    correctIndexes: q.correctIndexes,
    explanation: q.explanation,
    rank: leaderboard(game, game.players.size).find(e => e.playerId === player.playerId)?.rank ?? null,
  };
}

function endQuestion(io: Server, game: Game) {
  if (game.status !== 'question') return;
  clearTimeout(game.timer);
  game.status = 'reveal';
  // players who didn't answer: break streak
  for (const p of game.players.values()) {
    const answered = p.answers.some(a => a.questionIndex === game.currentIndex);
    if (!answered) p.streak = 0;
  }

  const lb = leaderboard(game);
  for (const p of game.players.values()) {
    if (p.socketId) io.to(p.socketId).emit('player:result', privateResult(game, p));
  }
  io.to(room(game.pin)).emit('question:end', questionSummary(game));
  io.to(room(game.pin)).emit('leaderboard:update', { leaderboard: lb });
}

async function endGame(io: Server, game: Game) {
  if (game.status === 'ended') return; // prevent double report writes
  clearTimeout(game.timer);
  game.status = 'ended';
  const sorted = [...game.players.values()].sort((a, b) => b.score - a.score);
  const finalPlayers = sorted.map((p, i) => {
    const answered = p.answers.length;
    const totalMs = p.answers.reduce((a, b) => a + b.ms, 0);
    return {
      playerId: p.playerId, userId: p.userId, name: p.name, score: p.score,
      correct: p.correct, answered,
      accuracy: answered ? Math.round((p.correct / answered) * 100) : 0,
      avgMs: answered ? Math.round(totalMs / answered) : 0,
      bestStreak: p.bestStreak, rank: i + 1,
    };
  });

  game.finalResult = {
    quizTitle: game.quizTitle,
    podium: finalPlayers.slice(0, 3),
    leaderboard: finalPlayers.slice(0, 10),
    totalPlayers: finalPlayers.length,
  };
  io.to(room(game.pin)).emit('game:over', game.finalResult);

  try {
    await GameResult.create({
      quiz: game.quizId, quizTitle: game.quizTitle, host: game.hostUserId, pin: game.pin,
      startedAt: new Date(game.startedAt), endedAt: new Date(),
      players: finalPlayers,
      questionStats: game.questions.map((q, i) => {
        const times = game.perQuestionMs.get(i) || [];
        return {
          index: i, text: q.text,
          answeredCount: times.length,
          correctCount: [...game.players.values()].filter(p =>
            p.answers.some(a => a.questionIndex === i && a.correct)).length,
          avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
        };
      }),
    });
  } catch (err) {
    console.error('[game] failed to persist result', err);
  }

  for (const p of game.players.values()) clearTimeout(p.disconnectTimer);
  setTimeout(() => games.delete(game.pin), 10 * 60 * 1000); // keep for late reconnects
}

// ---------- socket wiring ----------

export function registerGameHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // Optional authentication (hosts must be authenticated; players may be anonymous)
    let userId: string | undefined;
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try { userId = verifyToken(token).sub; } catch { /* anonymous is fine for players */ }
    }

    // ----- HOST -----
    socket.on('host:create', async ({ quizId }: { quizId: string }, ack) => {
      try {
        if (!userId) return ack?.({ error: 'Sign in to host a game.' });
        const quiz = await Quiz.findOne({ _id: quizId, owner: userId }).lean();
        if (!quiz) return ack?.({ error: 'Quiz not found.' });
        if (!quiz.questions.length) return ack?.({ error: 'Add at least one question before hosting.' });
        if (quiz.questions.some(q => !['multiple_choice', 'true_false', 'multiple_answer', 'code_output', 'image'].includes(q.type))) {
          return ack?.({ error: 'This quiz has an unsupported question type. Use multiple choice, true/false, multiple answer, image or code output.' });
        }

        let pin = pinGen();
        while (games.has(pin)) pin = pinGen();

        const game: Game = {
          pin, quizId: String(quiz._id), quizTitle: quiz.title,
          hostUserId: userId, hostSocketId: socket.id,
          questions: quiz.questions as IQuestion[],
          status: 'lobby', currentIndex: -1,
          questionStartedAt: 0, questionDeadline: 0, remainingOnPause: 0,
          players: new Map(), startedAt: Date.now(), perQuestionMs: new Map(), bannedPlayers: new Set(),
        };
        games.set(pin, game);
        socket.join(room(pin));
        socket.join(hostRoom(pin));
        ack?.({ pin, quizTitle: quiz.title, totalQuestions: quiz.questions.length });
      } catch {
        ack?.({ error: 'Could not create the game. Try again.' });
      }
    });

    const asHost = (pin: string): Game | null => {
      const game = games.get(pin);
      if (!game || game.hostUserId !== userId) return null;
      return game;
    };

    socket.on('host:rejoin', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game) return ack?.({ error: 'Game not found.' });
      game.hostSocketId = socket.id;
      socket.join(room(pin));
      socket.join(hostRoom(pin));
      const q = game.currentIndex >= 0 ? game.questions[game.currentIndex] : undefined;
      ack?.({
        state: lobbyState(game),
        leaderboard: leaderboard(game),
        answered: game.currentIndex >= 0 ? {
          answered: [...game.players.values()].filter(p => p.answers.some(a => a.questionIndex === game.currentIndex)).length,
          total: game.players.size,
        } : { answered: 0, total: game.players.size },
        activeQuestion: q ? {
          question: publicQuestion(q, game.currentIndex, game.questions.length),
          deadline: game.questionDeadline,
          serverNow: Date.now(),
        } : undefined,
        reveal: game.status === 'reveal' ? questionSummary(game) : undefined,
        finale: game.finalResult,
      });
    });

    socket.on('host:start', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game) return ack?.({ error: 'Game not found.' });
      if (game.status !== 'lobby') return ack?.({ error: 'Game already started.' });
      if (game.players.size === 0) return ack?.({ error: 'Wait for at least one player to join.' });
      game.startedAt = Date.now();
      startQuestion(io, game, 0);
      ack?.({ ok: true });
    });

    socket.on('host:next', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game) return ack?.({ error: 'Game not found.' });
      if (game.status !== 'reveal') return ack?.({ error: 'Finish the current question first.' });
      const next = game.currentIndex + 1;
      if (next >= game.questions.length) { endGame(io, game); return ack?.({ ok: true, ended: true }); }
      startQuestion(io, game, next);
      ack?.({ ok: true });
    });

    socket.on('host:skip', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game || game.status !== 'question') return ack?.({ error: 'No active question.' });
      endQuestion(io, game);
      ack?.({ ok: true });
    });

    socket.on('host:pause', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game || game.status !== 'question') return ack?.({ error: 'No active question to pause.' });
      clearTimeout(game.timer);
      game.remainingOnPause = Math.max(0, game.questionDeadline - Date.now());
      game.status = 'paused';
      io.to(room(pin)).emit('game:paused');
      ack?.({ ok: true });
    });

    socket.on('host:resume', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game || game.status !== 'paused') return ack?.({ error: 'Game is not paused.' });
      game.status = 'question';
      // Exclude the paused interval when computing the speed-based score.
      game.questionStartedAt = Date.now() - (game.questions[game.currentIndex].timeLimit * 1000 - game.remainingOnPause);
      game.questionDeadline = Date.now() + game.remainingOnPause;
      game.timer = setTimeout(() => endQuestion(io, game), game.remainingOnPause);
      io.to(room(pin)).emit('game:resumed', { deadline: game.questionDeadline, serverNow: Date.now() });
      ack?.({ ok: true });
    });

    socket.on('host:end', ({ pin }: { pin: string }, ack) => {
      const game = asHost(pin);
      if (!game) return ack?.({ error: 'Game not found.' });
      endGame(io, game);
      ack?.({ ok: true });
    });

    socket.on('host:kick', ({ pin, playerId }: { pin: string; playerId: string }, ack) => {
      const game = asHost(pin);
      const player = game?.players.get(playerId);
      if (!game || !player) return ack?.({ error: 'Player not found.' });
      if (player.socketId) {
        io.to(player.socketId).emit('player:kicked');
        const kickedSocket = io.sockets.sockets.get(player.socketId);
        kickedSocket?.leave(room(pin));
        if (kickedSocket) { kickedSocket.data.pin = undefined; kickedSocket.data.playerId = undefined; }
      }
      clearTimeout(player.disconnectTimer);
      game.bannedPlayers.add(playerId);
      game.players.delete(playerId);
      io.to(room(pin)).emit('lobby:state', lobbyState(game));
      ack?.({ ok: true });
    });

    // ----- PLAYER -----
    socket.on('player:join', ({ pin, playerId, name }: { pin: string; playerId: string; name: string }, ack) => {
      const game = typeof pin === 'string' ? games.get(pin) : undefined;
      if (!game) return ack?.({ error: 'That game PIN was not found. Check it and try again.' });
      if (typeof playerId !== 'string' || !/^[a-f0-9-]{32,48}$/i.test(playerId)) {
        return ack?.({ error: 'Invalid player ID. Refresh the page and try again.' });
      }
      if (game.bannedPlayers.has(playerId)) return ack?.({ error: 'You were removed from this game.' });
      if (game.status === 'ended' && !game.players.has(playerId)) return ack?.({ error: 'This game has already ended.' });

      const cleanName = String(name || '').trim().slice(0, 24);
      let player = game.players.get(playerId);

      if (player) {
        // reconnect: restore full state, keep score
        clearTimeout(player.disconnectTimer);
        if (player.socketId && player.socketId !== socket.id) {
          io.sockets.sockets.get(player.socketId)?.leave(room(pin));
        }
        player.socketId = socket.id;
        player.connected = true;
      } else {
        if (game.status !== 'lobby') return ack?.({ error: 'This game has already started.' });
        if (!cleanName) return ack?.({ error: 'Enter a nickname to join.' });
        if ([...game.players.values()].some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
          return ack?.({ error: 'That nickname is taken in this game. Pick another.' });
        }
        player = {
          playerId, socketId: socket.id, userId, name: cleanName,
          score: 0, streak: 0, bestStreak: 0, correct: 0, answers: [], connected: true,
        };
        game.players.set(playerId, player);
      }

      socket.join(room(pin));
      socket.data.pin = pin;
      socket.data.playerId = playerId;

      const state: any = { state: lobbyState(game), you: { name: player.name, score: player.score, streak: player.streak } };
      if (game.status === 'question' || game.status === 'paused') {
        const q = game.questions[game.currentIndex];
        state.activeQuestion = {
          question: publicQuestion(q, game.currentIndex, game.questions.length),
          deadline: game.questionDeadline,
          serverNow: Date.now(),
          alreadyAnswered: player.answers.some(a => a.questionIndex === game.currentIndex),
        };
      }
      if (game.status === 'reveal') state.revealedResult = privateResult(game, player);
      if (game.status === 'ended') state.finale = game.finalResult;
      io.to(room(pin)).emit('lobby:state', lobbyState(game));
      ack?.(state);
    });

    socket.on('player:answer', ({ pin, playerId, questionIndex, answer }: { pin: string; playerId: string; questionIndex: number; answer: number[] }, ack) => {
      const game = games.get(pin);
      const player = game?.players.get(playerId);
      if (!game || !player || player.socketId !== socket.id || game.bannedPlayers.has(playerId)) {
        return ack?.({ error: 'You are not in this game.' });
      }
      if (game.status !== 'question' || questionIndex !== game.currentIndex || Date.now() > game.questionDeadline) {
        return ack?.({ error: 'stale', late: true }); // question already over — client discards pending answer
      }
      if (player.answers.some(a => a.questionIndex === questionIndex)) {
        return ack?.({ ok: true, duplicate: true }); // idempotent for reconnect re-sends
      }
      const q = game.questions[questionIndex];
      if (!Array.isArray(answer) || answer.length < 1 || answer.length > q.options.length ||
          (q.type !== 'multiple_answer' && answer.length !== 1) ||
          new Set(answer).size !== answer.length ||
          answer.some(i => !Number.isInteger(i) || i < 0 || i >= q.options.length)) {
        return ack?.({ error: 'Invalid answer.' });
      }
      const ms = Math.max(0, Math.min(Date.now() - game.questionStartedAt, q.timeLimit * 1000));
      const { correct, points } = scoreAnswer(q, answer, ms, player.streak);
      if (correct) { player.streak += 1; player.correct += 1; player.bestStreak = Math.max(player.bestStreak, player.streak); }
      else player.streak = 0;
      player.score += points;
      player.answers.push({ questionIndex, answer, ms, correct, points });

      const times = game.perQuestionMs.get(questionIndex) || [];
      times.push(ms);
      game.perQuestionMs.set(questionIndex, times);

      const answeredCount = [...game.players.values()].filter(p => p.answers.some(a => a.questionIndex === questionIndex)).length;
      io.to(hostRoom(pin)).emit('host:answer-count', { answered: answeredCount, total: game.players.size });
      ack?.({ ok: true });

      // everyone connected has answered -> end early
      if (answeredCount >= connectedPlayers(game) && answeredCount >= game.players.size) {
        endQuestion(io, game);
      }
    });

    // ----- disconnect with grace period -----
    socket.on('disconnect', () => {
      const { pin, playerId } = socket.data as { pin?: string; playerId?: string };
      if (!pin || !playerId) return;
      const game = games.get(pin);
      const player = game?.players.get(playerId);
      if (!game || !player || player.socketId !== socket.id) return;
      player.connected = false;
      player.socketId = null;
      io.to(room(pin)).emit('lobby:state', lobbyState(game));
      // Never delete during an active game — scores are sacred. Only prune from an open lobby.
      if (game.status === 'lobby') {
        player.disconnectTimer = setTimeout(() => {
          if (!player.connected && game.status === 'lobby') {
            game.players.delete(playerId);
            io.to(room(pin)).emit('lobby:state', lobbyState(game));
          }
        }, DISCONNECT_GRACE_MS);
      }
    });
  });
}
