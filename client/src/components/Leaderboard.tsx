import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import type { LeaderboardEntry } from '../lib/types';

export function LeaderboardList({ entries, highlightId }: { entries: LeaderboardEntry[] | any[]; highlightId?: string }) {
  if (!entries.length) return <p className="py-6 text-center text-sm text-ink/45 dark:text-fog/45">No scores yet.</p>;
  return (
    <ol className="space-y-1.5">
      <AnimatePresence initial={false}>
        {entries.map(e => (
          <motion.li key={e.playerId} layout
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${e.playerId === highlightId
              ? 'bg-amber-aws/15 ring-1 ring-amber-aws/50'
              : 'bg-black/[0.04] dark:bg-white/[0.06]'}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-mono text-[13px] font-bold ${e.rank === 1 ? 'bg-amber-aws text-ink' : 'bg-ink text-paper dark:bg-paper dark:text-ink'}`}>{e.rank}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}</span>
            {e.streak >= 2 && <span className="flex items-center gap-0.5 text-[12px] font-bold text-amber-dark dark:text-amber-aws"><Flame className="h-3.5 w-3.5" aria-hidden />{e.streak}</span>}
            <span className="font-mono text-sm font-bold tabular-nums">{e.score.toLocaleString()}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
