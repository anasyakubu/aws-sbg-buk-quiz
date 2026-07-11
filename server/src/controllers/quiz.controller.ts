import { Response } from 'express';
import { z } from 'zod';
import { Quiz, CATEGORIES } from '../models/Quiz';
import { AuthRequest } from '../middleware/auth';

const questionSchema = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'multiple_answer', 'fill_blank', 'code_output', 'ordering', 'image']).default('multiple_choice'),
  text: z.string().min(1, 'Question text is required').max(1000),
  code: z.string().max(4000).optional(),
  language: z.string().max(30).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  options: z.array(z.string().min(1).max(300)).min(2, 'Add at least 2 options').max(6),
  correctIndexes: z.array(z.number().int().min(0)).min(1, 'Mark at least one correct answer'),
  explanation: z.string().max(1500).optional(),
  timeLimit: z.number().int().min(5).max(300).default(20),
  points: z.number().int().min(0).max(5000).default(1000),
  tags: z.array(z.string().max(40)).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
}).refine(q => q.correctIndexes.every(i => i < q.options.length), {
  message: 'Correct answer index is out of range',
});

export const quizSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(120),
  description: z.string().max(600).optional(),
  category: z.string().max(60).default('AWS'),
  visibility: z.enum(['private', 'public']).default('private'),
  aiGenerated: z.boolean().default(false),
  questions: z.array(questionSchema).default([]),
});

export async function listQuizzes(req: AuthRequest, res: Response) {
  const quizzes = await Quiz.find({ owner: req.user!.id })
    .sort({ updatedAt: -1 })
    .select('title description category visibility aiGenerated questions updatedAt')
    .lean();
  res.json({
    quizzes: quizzes.map(q => ({ ...q, questionCount: q.questions.length, questions: undefined })),
  });
}

export async function getQuiz(req: AuthRequest, res: Response) {
  const quiz = await Quiz.findOne({ _id: req.params.id, owner: req.user!.id });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ quiz });
}

export async function createQuiz(req: AuthRequest, res: Response) {
  const quiz = await Quiz.create({ ...req.body, owner: req.user!.id });
  res.status(201).json({ quiz });
}

export async function updateQuiz(req: AuthRequest, res: Response) {
  const quiz = await Quiz.findOneAndUpdate(
    { _id: req.params.id, owner: req.user!.id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ quiz });
}

export async function deleteQuiz(req: AuthRequest, res: Response) {
  const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, owner: req.user!.id });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ ok: true });
}

export function categories(_req: AuthRequest, res: Response) {
  res.json({ categories: CATEGORIES });
}
