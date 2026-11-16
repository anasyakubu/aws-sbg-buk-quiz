import mongoose, { Schema } from 'mongoose';

export interface ILiveAnswer {
  questionIndex: number;
  answer: number[];
  ms: number;
  correct: boolean;
  points: number;
}
export interface ILivePlayer {
  pin: string;
  playerId: string;
  userId?: mongoose.Types.ObjectId;
  name: string;
  nameKey: string;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  answers: ILiveAnswer[];
  banned: boolean;
  lastSeenAt: number;
  expiresAt: Date;
}

const schema = new Schema<ILivePlayer>({
  pin: { type: String, required: true, index: true },
  playerId: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, maxlength: 24 },
  nameKey: { type: String, required: true, maxlength: 24 },
  score: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  answers: [{ questionIndex: Number, answer: [Number], ms: Number, correct: Boolean, points: Number }],
  banned: { type: Boolean, default: false },
  lastSeenAt: { type: Number, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ pin: 1, playerId: 1 }, { unique: true });
schema.index({ pin: 1, nameKey: 1 }, { unique: true, partialFilterExpression: { banned: false } });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LivePlayer = mongoose.model<ILivePlayer>('LivePlayer', schema);
