export interface User {
  id: string; email: string; name: string; role: string;
  institution?: string; department?: string; skillLevel?: string; avatarUrl?: string;
}
export interface Question {
  _id?: string;
  type: 'multiple_choice' | 'true_false' | 'multiple_answer' | 'fill_blank' | 'code_output' | 'ordering' | 'image';
  text: string; code?: string; language?: string; imageUrl?: string;
  options: string[]; correctIndexes: number[]; explanation?: string;
  timeLimit: number; points: number; tags?: string[]; difficulty?: string;
}
export interface Quiz {
  _id: string; title: string; description?: string; category: string;
  visibility: 'private' | 'public'; aiGenerated: boolean;
  questions: Question[]; updatedAt: string; questionCount?: number;
}
export interface PublicQuestion {
  index: number; total: number; type: string; text: string;
  code?: string; language?: string; imageUrl?: string;
  options: string[]; timeLimit: number; multi: boolean;
}
export interface LeaderboardEntry {
  rank: number; playerId: string; name: string; score: number;
  correct: number; streak: number; connected: boolean;
}
