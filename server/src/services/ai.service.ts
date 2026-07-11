import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../config/env';

export interface GenerateParams {
  provider: 'openai' | 'anthropic';
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  count: number;
  language?: string;
  audience?: string;
  timePerQuestion: number;
}

const aiQuestionSchema = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'multiple_answer', 'code_output']).catch('multiple_choice'),
  text: z.string().min(1),
  code: z.string().optional(),
  language: z.string().optional(),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndexes: z.array(z.number().int().min(0)).min(1),
  explanation: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).catch('medium'),
  tags: z.array(z.string()).optional(),
});

function buildPrompt(p: GenerateParams): string {
  return `Generate exactly ${p.count} quiz questions for a live quiz at an AWS Student Builder Group event.

Topic: ${p.topic}
Difficulty: ${p.difficulty}
Audience: ${p.audience || 'university students learning cloud and software engineering'}
${p.language ? `Programming language (for any code questions): ${p.language}` : ''}

Rules:
- Mix of multiple_choice and true_false; include multiple_answer or code_output only when it genuinely fits.
- For true_false, options must be exactly ["True","False"].
- 4 options for multiple_choice unless the question demands otherwise.
- correctIndexes are 0-based indexes into options.
- Every question needs a short, teaching-quality "explanation".
- For code_output questions, put the snippet in "code" and set "language".
- Questions must be factually accurate and unambiguous.

Respond with ONLY a JSON array (no markdown fences, no prose) of objects with keys:
type, text, code?, language?, options, correctIndexes, explanation, difficulty, tags`;
}

function parseQuestions(raw: string, timePerQuestion: number) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('AI response was not valid JSON.');
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('AI response was not a JSON array.');
  const questions = [];
  for (const item of arr) {
    const parsed = aiQuestionSchema.safeParse(item);
    if (!parsed.success) continue; // skip malformed items rather than failing the batch
    const q = parsed.data;
    if (!q.correctIndexes.every(i => i < q.options.length)) continue;
    questions.push({ ...q, timeLimit: timePerQuestion, points: 1000 });
  }
  if (questions.length === 0) throw new Error('The AI did not return any usable questions. Try again.');
  return questions;
}

export async function generateQuestions(p: GenerateParams) {
  const prompt = buildPrompt(p);

  if (p.provider === 'openai') {
    if (!env.openaiKey) throw Object.assign(new Error('OpenAI is not configured. Add OPENAI_API_KEY on the server.'), { status: 400 });
    const client = new OpenAI({ apiKey: env.openaiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    return parseQuestions(completion.choices[0]?.message?.content || '', p.timePerQuestion);
  }

  if (!env.anthropicKey) throw Object.assign(new Error('Anthropic is not configured. Add ANTHROPIC_API_KEY on the server.'), { status: 400 });
  const client = new Anthropic({ apiKey: env.anthropicKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = message.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseQuestions(text, p.timePerQuestion);
}
