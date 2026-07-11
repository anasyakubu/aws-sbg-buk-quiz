import { Response } from 'express';
import { GameResult } from '../models/GameResult';
import { AuthRequest } from '../middleware/auth';

// Games this user hosted
export async function hostedGames(req: AuthRequest, res: Response) {
  const results = await GameResult.find({ host: req.user!.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('quizTitle pin startedAt endedAt players.name players.score players.rank')
    .lean();
  res.json({ results });
}

export async function gameDetail(req: AuthRequest, res: Response) {
  const result = await GameResult.findById(req.params.id).lean();
  if (!result) return res.status(404).json({ error: 'Report not found.' });
  const isHost = String(result.host) === req.user!.id;
  const played = result.players.some(p => String(p.userId || '') === req.user!.id);
  if (!isHost && !played) return res.status(403).json({ error: 'You do not have access to this report.' });
  res.json({ result });
}

// Games this user played in (score history)
export async function myHistory(req: AuthRequest, res: Response) {
  const results = await GameResult.find({ 'players.userId': req.user!.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const history = results.map(r => {
    const me = r.players.find(p => String(p.userId || '') === req.user!.id)!;
    return {
      id: r._id, quizTitle: r.quizTitle, date: r.endedAt,
      score: me.score, rank: me.rank, totalPlayers: r.players.length,
      accuracy: me.accuracy,
    };
  });
  res.json({ history });
}
