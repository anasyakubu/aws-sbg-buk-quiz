import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Sparkles, Play, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Quiz } from '../lib/types';
import { EmptyState, SkeletonRows } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => api<{ quizzes: Quiz[] }>('/quizzes').then(r => setQuizzes(r.quizzes)).catch(e => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api(`/quizzes/${id}`, { method: 'DELETE' }, false);
      setQuizzes(q => q!.filter(x => x._id !== id));
      toast.success('Quiz deleted');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your quizzes</h1>
          <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">Hi {user?.name?.split(' ')[0]} — build one by hand or let AI draft it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/generate" className="btn-ghost"><Sparkles className="h-4 w-4" /> Generate with AI</Link>
          <Link to="/quiz/new" className="btn-primary"><Plus className="h-4 w-4" /> New quiz</Link>
        </div>
      </div>

      {quizzes === null ? <SkeletonRows rows={3} /> : quizzes.length === 0 ? (
        <EmptyState
          title="No quizzes yet"
          hint="Create your first quiz for the next SBG BUK session — manually or with AI."
          action={<Link to="/quiz/new" className="btn-primary"><Plus className="h-4 w-4" /> Create a quiz</Link>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {quizzes.map(q => (
            <li key={q._id} className="card group p-5 transition hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{q.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink/55 dark:text-fog/55">
                    {q.category} · {q.questionCount} question{q.questionCount === 1 ? '' : 's'}
                    {q.aiGenerated && ' · AI-drafted'}
                  </p>
                </div>
                <button onClick={() => remove(q._id, q.title)} className="btn-danger !min-h-0 shrink-0 !px-2 !py-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Delete ${q.title}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => navigate(`/host/${q._id}`)} className="btn-primary flex-1 !min-h-[40px]" disabled={!q.questionCount}>
                  <Play className="h-4 w-4" /> Host live
                </button>
                <Link to={`/quiz/${q._id}`} className="btn-ghost !min-h-[40px]"><Pencil className="h-4 w-4" /> Edit</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
