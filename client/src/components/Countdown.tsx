import { useEffect, useState } from 'react';

export function Countdown({ deadline, skew, timeLimit }: { deadline: number; skew: number; timeLimit: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - (Date.now() + skew)));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, deadline - (Date.now() + skew))), 100);
    return () => clearInterval(id);
  }, [deadline, skew]);
  const secs = Math.ceil(remaining / 1000);
  const pct = Math.min(100, (remaining / (timeLimit * 1000)) * 100);
  return (
    <div aria-live="off">
      <div className="flex items-baseline justify-between">
        <span className={`font-mono text-3xl font-bold tabular-nums ${secs <= 5 ? 'text-red-600 dark:text-red-400' : ''}`} role="timer" aria-label={`${secs} seconds remaining`}>{secs}s</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.08]">
        <div className={`h-full rounded-full transition-[width] duration-100 ${secs <= 5 ? 'bg-red-500' : 'bg-amber-aws'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
