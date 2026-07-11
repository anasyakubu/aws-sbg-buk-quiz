import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { generateQuestions } from '../services/ai.service';
import { env } from '../config/env';

export const generateSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  topic: z.string().min(2, 'Enter a topic').max(200),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  count: z.number().int().min(1).max(20).default(5),
  language: z.string().max(40).optional(),
  audience: z.string().max(200).optional(),
  timePerQuestion: z.number().int().min(5).max(300).default(20),
});

export function providers(_req: AuthRequest, res: Response) {
  res.json({
    providers: [
      { id: 'anthropic', name: 'Anthropic Claude', configured: Boolean(env.anthropicKey) },
      { id: 'openai', name: 'OpenAI', configured: Boolean(env.openaiKey) },
    ],
  });
}

export async function generate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const questions = await generateQuestions(req.body);
    res.json({ questions });
  } catch (err) {
    next(err);
  }
}
