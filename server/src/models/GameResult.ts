import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGameResult extends Document {
  quiz: Types.ObjectId;
  quizTitle: string;
  host: Types.ObjectId;
  pin: string;
  startedAt: Date;
  endedAt: Date;
  players: {
    playerId: string;
    userId?: Types.ObjectId;
    name: string;
    score: number;
    correct: number;
    answered: number;
    accuracy: number;   // 0–100
    avgMs: number;      // average response time
    bestStreak: number;
    rank: number;
  }[];
  questionStats: {
    index: number;
    text: string;
    correctCount: number;
    answeredCount: number;
    avgMs: number;
  }[];
}

const gameResultSchema = new Schema<IGameResult>(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    quizTitle: { type: String, required: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pin: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    players: [
      {
        playerId: String,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        name: String,
        score: Number,
        correct: Number,
        answered: Number,
        accuracy: Number,
        avgMs: Number,
        bestStreak: Number,
        rank: Number,
      },
    ],
    questionStats: [
      { index: Number, text: String, correctCount: Number, answeredCount: Number, avgMs: Number },
    ],
  },
  { timestamps: true }
);

gameResultSchema.index({ 'players.userId': 1, createdAt: -1 });

export const GameResult = mongoose.model<IGameResult>('GameResult', gameResultSchema);
