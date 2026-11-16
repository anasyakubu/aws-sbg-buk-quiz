import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, Check, Save, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import type { Question, Quiz } from '../lib/types';
import { Field, Spinner } from '../components/ui';

const blankQuestion = (): Question => ({
  type: 'multiple_choice', text: '', options: ['', '', '', ''], correctIndexes: [0],
  timeLimit: 20, points: 1000, explanation: '', difficulty: 'medium',
});

export default function QuizEditor() {
  const { id } = useParams();
  const { state } = useLocation() as { state?: { draft?: Partial<Quiz> } };
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ title: '', description: '', category: 'AWS' });
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const [categories, setCategories] = useState<string[]>(['AWS']);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    api<{ categories: string[] }>('/quizzes/categories').then(r => setCategories(r.categories)).catch(() => {});
    if (state?.draft) {
      setMeta({ title: state.draft.title || '', description: state.draft.description || '', category: state.draft.category || 'AWS' });
      if (state.draft.questions?.length) setQuestions(state.draft.questions as Question[]);
      setAiGenerated(Boolean(state.draft.aiGenerated));
    }
    if (id) {
      api<{ quiz: Quiz }>(`/quizzes/${id}`)
        .then(({ quiz }) => {
          setMeta({ title: quiz.title, description: quiz.description || '', category: quiz.category });
          setQuestions(quiz.questions.length ? quiz.questions : [blankQuestion()]);
          setAiGenerated(quiz.aiGenerated);
        })
        .catch(e => { toast.error(e.message); navigate('/dashboard'); })
        .finally(() => setLoading(false));
    }
  }, [id]); // eslint-disable-line

  const updateQ = (i: number, patch: Partial<Question>) =>
    setQuestions(qs => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const setType = (i: number, type: Question['type']) => {
    const q = questions[i];
    if (type === 'true_false') updateQ(i, { type, options: ['True', 'False'], correctIndexes: [0] });
    else if (q.type === 'true_false') updateQ(i, { type, options: ['', '', '', ''], correctIndexes: [0] });
    else updateQ(i, { type, correctIndexes: type === 'multiple_answer' ? q.correctIndexes : [q.correctIndexes[0] ?? 0] });
  };

  const toggleCorrect = (qi: number, oi: number) => {
    const q = questions[qi];
    if (q.type === 'multiple_answer') {
      const set = new Set(q.correctIndexes);
      set.has(oi) ? set.delete(oi) : set.add(oi);
      if (set.size) updateQ(qi, { correctIndexes: [...set].sort() });
    } else updateQ(qi, { correctIndexes: [oi] });
  };

  const move = (i: number, dir: -1 | 1) => setQuestions(qs => {
    const j = i + dir;
    if (j < 0 || j >= qs.length) return qs;
    const copy = [...qs];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  const validate = (): string | null => {
    if (meta.title.trim().length < 2) return 'Give the quiz a title.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `Question ${i + 1} needs text.`;
      if (q.options.some(o => !o.trim())) return `Question ${i + 1} has an empty option.`;
      if (!q.correctIndexes.length) return `Question ${i + 1} needs a correct answer.`;
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) return toast.error(problem);
    setBusy(true);
    const body = JSON.stringify({
      ...meta, aiGenerated,
      questions: questions.map(({ _id, ...q }) => ({ ...q, options: q.options.map(o => o.trim()), text: q.text.trim() })),
    });
    try {
      if (id) await api(`/quizzes/${id}`, { method: 'PUT', body }, false);
      else await api('/quizzes', { method: 'POST', body }, false);
      toast.success(id ? 'Changes saved' : 'Quiz created');
      navigate('/dashboard');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-7 w-7" /></div>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-5 !min-h-0 !px-3 !py-1.5 text-sm"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="card space-y-4 p-6">
        <Field label="Quiz title" htmlFor="title">
          <input id="title" className="input" placeholder="e.g. AWS Fundamentals — Week 3" value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="cat">
            <select id="cat" className="input" value={meta.category} onChange={e => setMeta(m => ({ ...m, category: e.target.value }))}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description (optional)" htmlFor="desc">
            <input id="desc" className="input" value={meta.description} onChange={e => setMeta(m => ({ ...m, description: e.target.value }))} />
          </Field>
        </div>
      </div>

      <ol className="mt-6 space-y-5">
        {questions.map((q, i) => (
          <li key={i} className="card p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-ink/50 dark:text-fog/50">Question {i + 1} of {questions.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost !min-h-0 !px-2 !py-1.5" aria-label="Move question up"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="btn-ghost !min-h-0 !px-2 !py-1.5" aria-label="Move question down"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => setQuestions(qs => qs.length > 1 ? qs.filter((_, j) => j !== i) : qs)} disabled={questions.length === 1} className="btn-danger !min-h-0 !px-2 !py-1.5" aria-label="Delete question"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type" htmlFor={`type-${i}`}>
                <select id={`type-${i}`} className="input" value={q.type} onChange={e => setType(i, e.target.value as Question['type'])}>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="multiple_answer">Multiple answers</option>
                  <option value="code_output">Code output</option>
                </select>
              </Field>
              <Field label="Time limit (s)" htmlFor={`time-${i}`}>
                <input id={`time-${i}`} type="number" min={5} max={300} className="input" value={q.timeLimit} onChange={e => updateQ(i, { timeLimit: Math.max(5, Math.min(300, Number(e.target.value) || 20)) })} />
              </Field>
              <Field label="Points" htmlFor={`pts-${i}`}>
                <input id={`pts-${i}`} type="number" min={0} max={5000} step={100} className="input" value={q.points} onChange={e => updateQ(i, { points: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) })} />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Question" htmlFor={`text-${i}`}>
                <textarea id={`text-${i}`} rows={2} className="input resize-y" value={q.text} onChange={e => updateQ(i, { text: e.target.value })} />
              </Field>
            </div>

            {q.type === 'code_output' && (
              <div className="mt-4">
                <Field label="Code snippet" htmlFor={`code-${i}`}>
                  <textarea id={`code-${i}`} rows={4} spellCheck={false} className="input resize-y font-mono text-[13px]" value={q.code || ''} onChange={e => updateQ(i, { code: e.target.value })} />
                </Field>
              </div>
            )}

            <fieldset className="mt-4">
              <legend className="label">Options — tap the check to mark correct{q.type === 'multiple_answer' ? ' (select all that apply)' : ''}</legend>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleCorrect(i, oi)}
                      aria-pressed={q.correctIndexes.includes(oi)}
                      aria-label={`Mark option ${oi + 1} ${q.correctIndexes.includes(oi) ? 'incorrect' : 'correct'}`}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${q.correctIndexes.includes(oi)
                        ? 'border-amber-aws bg-amber-aws text-ink'
                        : 'border-black/15 text-ink/30 hover:border-amber-aws/60 dark:border-ink-line dark:text-fog/30'}`}>
                      <Check className="h-4 w-4" />
                    </button>
                    <input className="input" placeholder={`Option ${oi + 1}`} value={opt}
                      disabled={q.type === 'true_false'}
                      onChange={e => updateQ(i, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })} />
                    {q.type !== 'true_false' && q.options.length > 2 && (
                      <button type="button" className="btn-ghost !min-h-0 shrink-0 !px-2 !py-2" aria-label="Remove option"
                        onClick={() => updateQ(i, {
                          options: q.options.filter((_, j) => j !== oi),
                          correctIndexes: q.correctIndexes.filter(c => c !== oi).map(c => (c > oi ? c - 1 : c)).length
                            ? q.correctIndexes.filter(c => c !== oi).map(c => (c > oi ? c - 1 : c)) : [0],
                        })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {q.type !== 'true_false' && q.options.length < 6 && (
                  <button type="button" onClick={() => updateQ(i, { options: [...q.options, ''] })} className="btn-ghost !min-h-0 !px-3 !py-2 text-sm">
                    <Plus className="h-4 w-4" /> Add option
                  </button>
                )}
              </div>
            </fieldset>

            <div className="mt-4">
              <Field label="Explanation shown after the reveal (optional)" htmlFor={`exp-${i}`}>
                <textarea id={`exp-${i}`} rows={2} className="input resize-y" value={q.explanation || ''} onChange={e => updateQ(i, { explanation: e.target.value })} />
              </Field>
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-4 mt-6 flex gap-2">
        <button onClick={() => setQuestions(qs => [...qs, blankQuestion()])} className="btn-ghost flex-1 bg-paper dark:bg-ink-soft"><Plus className="h-4 w-4" /> Add question</button>
        <button onClick={save} className="btn-primary flex-1 shadow-lift" disabled={busy}>{busy ? <Spinner /> : <><Save className="h-4 w-4" /> {id ? 'Save changes' : 'Create quiz'}</>}</button>
      </div>
    </main>
  );
}
