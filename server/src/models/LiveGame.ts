import mongoose, { Schema } from 'mongoose';
import type { IQuestion } from './Quiz';

/** Live quiz metadata is persisted in MongoDB, never stored in a Vercel function's memory. */
export interface ILiveGame {
  pin: string;
  quizId: mongoose.Types.ObjectId;
  quizTitle: string;
  hostUserId: mongoose.Types.ObjectId;
  hostSessionKey?: string;
  questions: IQuestion[];
  status: 'lobby' | 'question' | 'paused' | 'reveal' | 'ended';
  currentIndex: number;
  questionStartedAt: number;
  questionDeadline: number;
  remainingOnPause: number;
  startedAt: number;
  finalResult?: Record<string, unknown>;
  expiresAt: Date;
}

const schema = new Schema<ILiveGame>(
  {
    pin: { type: String, required: true, unique: true, index: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    quizTitle: { type: String, required: true },
    hostUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostSessionKey: { type: String },
    // Mongoose typings don't accept [Schema.Types.Mixed] for IQuestion[] directly.
    // Cast the definition; the field is still typed via ILiveGame.questions.
    questions: { type: [Schema.Types.Mixed], required: true } as any,
    status: {
      type: String,
      enum: ['lobby', 'question', 'paused', 'reveal', 'ended'],
      default: 'lobby',
    },
    currentIndex: { type: Number, default: -1 },
    questionStartedAt: { type: Number, default: 0 },
    questionDeadline: { type: Number, default: 0 },
    remainingOnPause: { type: Number, default: 0 },
    startedAt: { type: Number, default: 0 },
    finalResult: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index(
  { hostUserId: 1, hostSessionKey: 1 },
  {
    unique: true,
    partialFilterExpression: { hostSessionKey: { $exists: true } },
  },
);

export const LiveGame = mongoose.model<ILiveGame>('LiveGame', schema);