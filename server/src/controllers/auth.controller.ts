import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User';
import { signToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  institution: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  institution: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal('')),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

const publicUser = (u: any) => ({
  id: u.id, email: u.email, name: u.name, role: u.role,
  institution: u.institution, department: u.department,
  skillLevel: u.skillLevel, avatarUrl: u.avatarUrl,
});

export async function register(req: AuthRequest, res: Response) {
  const { name, email, password, institution, department } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, institution, department });
  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
}

export async function login(req: AuthRequest, res: Response) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, user: publicUser(user) });
}

export async function me(req: AuthRequest, res: Response) {
  res.json({ user: publicUser(req.user) });
}

export async function updateProfile(req: AuthRequest, res: Response) {
  Object.assign(req.user!, req.body);
  await req.user!.save();
  res.json({ user: publicUser(req.user) });
}

export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const user = req.user!;
  if (user.passwordHash) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ ok: true });
}
