import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'admin' | 'host' | 'participant';

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  googleId?: string;
  name: string;
  role: UserRole;
  institution?: string;
  department?: string;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String },
    googleId: { type: String, index: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    role: { type: String, enum: ['admin', 'host', 'participant'], default: 'host' },
    institution: { type: String, default: 'Bayero University Kano', maxlength: 120 },
    department: { type: String, maxlength: 120 },
    skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc: Document, ret: Record<string, any>) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);