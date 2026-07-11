import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trophy, Presentation } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, SkeletonRows } from '../components/ui';

interface Played { id: string; quizTitle: string; date: string; score: number; rank: number; totalPlayers: number; accuracy: number; }
interface Hosted { _id: string; quizTitle: string; pin: string; endedAt: string; players: { name: string; score: number; rank: number }[]; }

export default function History() {
  const [tab, setTab] = useState<'played' | 'hosted'>('played');
  const [played, setPlayed] = useState<Played[] | null>(null);
  const [hosted, setHosted] = useState<Hosted[] | null>(null);

  useEffect(() => {
    api<{ history: Played[] }>('/results/history').then(r => setPlayed(r.history)).catch(e => toast.error(e.message));
    api<{ results: Hosted[] }>('/results/hosted').then(r => setHosted(r.results)).catch(() => {});
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">History</h1>
      <div role="tablist" className="mt-5 flex gap-1 rounded-lg bg-black/[0.05] p-1 dark:bg-white/[0.07]">
        {(['played', 'hosted'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'bg-paper shadow-card dark:bg-ink-soft' : 'text-ink/55 dark:text-fog/55'}`}>
            {t === 'played' ? 'Games played' : 'Games hosted'}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'played' ? (
          played === null ? <SkeletonRows /> : played.length === 0 ? (
            <EmptyState title="No games played yet" hint="Join a live game with a PIN and your results will show up here." />
          ) : (
            <ul className="space-y-3">
              {played.map(g => (
                <li key={g.id} className="card flex items-center gap-4 p-5">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-extrabold ${g.rank === 1 ? 'bg-amber-aws text-ink' : 'bg-black/[0.05] dark:bg-white/[0.08]'}`}>
                    {g.rank <= 3 ? <Trophy className="h-5 w-5" aria-hidden /> : `#${g.rank}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{g.quizTitle}</p>
                    <p className="text-[13px] text-ink/55 dark:text-fog/55">{fmt(g.date)} · rank {g.rank} of {g.totalPlayers} · {g.accuracy}% accuracy</p>
                  </div>
                  <span className="font-mono font-bold tabular-nums">{g.score.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          hosted === null ? <SkeletonRows /> : hosted.length === 0 ? (
            <EmptyState title="No games hosted yet" hint="Host a quiz from your dashboard and its report will appear here." />
          ) : (
            <ul className="space-y-3">
              {hosted.map(g => {
                const winner = g.players.find(p => p.rank === 1);
                return (
                  <li key={g._id} className="card flex items-center gap-4 p-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/[0.05] dark:bg-white/[0.08]">
                      <Presentation className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{g.quizTitle}</p>
                      <p className="text-[13px] text-ink/55 dark:text-fog/55">
                        {fmt(g.endedAt)} · PIN {g.pin} · {g.players.length} player{g.players.length === 1 ? '' : 's'}
                        {winner && ` · won by ${winner.name}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </main>
  );
}
