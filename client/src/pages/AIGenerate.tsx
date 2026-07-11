import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import type { Question } from '../lib/types';
import { Field, Spinner } from '../components/ui';

interface Provider { id: 'openai' | 'anthropic'; name: string; configured: boolean; }

export default function AIGenerate() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState({
    provider: 'anthropic' as 'openai' | 'anthropic',
    topic: '', difficulty: 'mixed', count: 5, language: '', audience: '', timePerQuestion: 20,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ providers: Provider[] }>('/ai/providers').then(r => {
      setProviders(r.providers);
      const first = r.providers.find(p => p.configured);
      if (first) setForm(f => ({ ...f, provider: first.id }));
    }).catch(() => {});
  }, []);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { questions } = await api<{ questions: Question[] }>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ ...form, language: form.language || undefined, audience: form.audience || undefined }),
      }, false);
      toast.success(`Drafted ${questions.length} questions — review and edit before publishing.`);
      navigate('/quiz/new', {
        state: { draft: { title: `${form.topic} quiz`, category: 'AWS', aiGenerated: true, questions } },
      });
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const anyConfigured = providers.some(p => p.configured);

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-5 !min-h-0 !px-3 !py-1.5 text-sm"><ArrowLeft className="h-4 w-4" /> Back</button>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Sparkles className="h-6 w-6 text-amber-dark dark:text-amber-aws" /> Generate a quiz with AI</h1>
      <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">The draft opens in the editor — nothing goes live until you've reviewed every question.</p>

      {providers.length > 0 && !anyConfigured && (
        <p role="alert" className="mt-5 rounded-lg bg-amber-aws/15 px-4 py-3 text-sm font-medium">
          No AI provider is configured yet. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to the server's .env file.
        </p>
      )}

      <form onSubmit={generate} className="card mt-6 space-y-4 p-6">
        <Field label="Provider" htmlFor="prov">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="AI provider">
            {providers.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={form.provider === p.id}
                disabled={!p.configured}
                onClick={() => setForm(f => ({ ...f, provider: p.id }))}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${form.provider === p.id
                  ? 'border-amber-aws bg-amber-aws/10 text-amber-dark dark:text-amber-aws'
                  : 'border-black/10 hover:border-amber-aws/50 dark:border-ink-line'}`}>
                {p.name}{!p.configured && ' (not configured)'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Topic" htmlFor="topic">
          <input id="topic" required className="input" placeholder="e.g. Amazon S3 storage classes" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Difficulty" htmlFor="diff">
            <select id="diff" className="input" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
              <option value="easy">Easy</option><option value="medium">Medium</option>
              <option value="hard">Hard</option><option value="mixed">Mixed</option>
            </select>
          </Field>
          <Field label="Questions" htmlFor="count">
            <input id="count" type="number" min={1} max={20} className="input" value={form.count} onChange={e => setForm(f => ({ ...f, count: Math.max(1, Math.min(20, Number(e.target.value) || 5)) }))} />
          </Field>
          <Field label="Seconds each" htmlFor="tpq">
            <input id="tpq" type="number" min={5} max={300} className="input" value={form.timePerQuestion} onChange={e => setForm(f => ({ ...f, timePerQuestion: Math.max(5, Math.min(300, Number(e.target.value) || 20)) }))} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Programming language (optional)" htmlFor="lang">
            <input id="lang" className="input" placeholder="e.g. Python" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} />
          </Field>
          <Field label="Audience (optional)" htmlFor="aud">
            <input id="aud" className="input" placeholder="e.g. beginners at a cloud workshop" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} />
          </Field>
        </div>
        <button className="btn-primary w-full" disabled={busy || !anyConfigured}>
          {busy ? <><Spinner /> Drafting questions…</> : <>Generate draft <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </main>
  );
}
