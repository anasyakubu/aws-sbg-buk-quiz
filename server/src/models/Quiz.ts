import mongoose, { Schema, Document, Types } from 'mongoose';

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'multiple_answer'
  | 'fill_blank'
  | 'code_output'
  | 'ordering'
  | 'image';

export interface IQuestion {
  _id?: Types.ObjectId;
  type: QuestionType;
  text: string;
  code?: string;            // optional code snippet (rendered monospaced)
  language?: string;        // syntax hint for the snippet
  imageUrl?: string;
  options: string[];        // 2–6 options; ['True','False'] for true_false
  correctIndexes: number[]; // one index for MCQ/TF, several for multiple_answer
  explanation?: string;
  timeLimit: number;        // seconds
  points: number;           // base points (default 1000 scale)
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface IQuiz extends Document {
  owner: Types.ObjectId;
  title: string;
  description?: string;
  category: string;
  questions: IQuestion[];
  visibility: 'private' | 'public';
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>({
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'multiple_answer', 'fill_blank', 'code_output', 'ordering', 'image'],
    default: 'multiple_choice',
  },
  text: { type: String, required: true, maxlength: 1000 },
  code: { type: String, maxlength: 4000 },
  language: { type: String, maxlength: 30 },
  imageUrl: { type: String },
  options: {
    type: [String],
    validate: { validator: (v: string[]) => v.length >= 2 && v.length <= 6, message: '2–6 options required' },
  },
  correctIndexes: {
    type: [Number],
    validate: { validator: (v: number[]) => v.length >= 1, message: 'At least one correct answer required' },
  },
  explanation: { type: String, maxlength: 1500 },
  timeLimit: { type: Number, default: 20, min: 5, max: 300 },
  points: { type: Number, default: 1000, min: 0, max: 5000 },
  tags: [{ type: String, maxlength: 40 }],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
});

const quizSchema = new Schema<IQuiz>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 600 },
    category: { type: String, default: 'AWS', maxlength: 60, index: true },
    questions: { type: [questionSchema], default: [] },
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    aiGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

quizSchema.index({ owner: 1, updatedAt: -1 });

export const Quiz = mongoose.model<IQuiz>('Quiz', quizSchema);

export const CATEGORIES = [
  'AWS', 'Cloud Computing', 'DevOps', 'Docker', 'Linux', 'Git', 'GitHub',
  'Networking', 'Cybersecurity', 'Python', 'JavaScript', 'React', 'Node.js',
  'TypeScript', 'Machine Learning', 'Artificial Intelligence', 'Databases',
  'Operating Systems', 'Programming', 'Data Structures', 'Algorithms', 'Other',
];
