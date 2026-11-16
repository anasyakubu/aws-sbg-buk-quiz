import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Check, X, Flame, Hourglass } from 'lucide-react';
import { answerLive, joinLive, liveState } from '../lib/live';
import { getPlayerId, savePendingAnswer, getPendingAnswer, clearPendingAnswer } from '../lib/player';
import type { PublicQuestion } from '../lib/types';
import { Countdown } from '../components/Countdown';
import { LeaderboardList } from '../components/Leaderboard';
import { Spinner } from '../components/ui';

type Phase = 'connecting' | 'lobby' | 'question' | 'waiting' | 'result' | 'paused' | 'over' | 'kicked';

export default function Play() {
  const { pin = '' } = useParams();
  const navigate = useNavigate();
  const playerId = getPlayerId();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [quizTitle, setQuizTitle] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [skew, setSkew] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [me, setMe] = useState({ score: 0, streak: 0 });
  const [result, setResult] = useState<any>(null);
  const [finale, setFinale] = useState<any>(null);
  const [connectionError, setConnectionError] = useState(false);
  const phaseRef = useRef<Phase>('connecting');
  phaseRef.current = phase;
  const questionRef = useRef<PublicQuestion | null>(null);
  questionRef.current = question;

  const currentQuestionIndex = useRef(-1);
  const loading = useRef(false);

  const applyJoined = (res: any) => {
    if (res.kicked) { setPhase('kicked'); return; }
    if (!res.state || !res.you) return;
    setQuizTitle(res.state.quizTitle);
    setPlayerCount(res.state.playerCount ?? res.state.players?.length ?? 0);
    setMe({ score: res.you.score, streak: res.you.streak });
    if (res.state.status === 'ended') {
      clearPendingAnswer(pin);
      if (res.finale) setFinale(res.finale);
      setPhase('over'); return;
    }
    if (res.state.status === 'reveal' && res.revealedResult) {
      clearPendingAnswer(pin);
      setResult(res.revealedResult);
      setPhase('result'); return;
    }
    if (res.activeQuestion) {
      const active = res.activeQuestion;
      setSkew(active.serverNow - Date.now());
      setDeadline(active.deadline);
      setQuestion(active.question);
      const changed = currentQuestionIndex.current !== active.question.index;
      if (changed) {
        currentQuestionIndex.current = active.question.index;
        setSelected([]);
        setResult(null);
      }
      const pending = getPendingAnswer(pin);
      if (active.alreadyAnswered) {
        clearPendingAnswer(pin);
        setPhase('waiting');
      } else if (pending && pending.questionIndex === active.question.index) {
        // A failed POST can be resent safely; MongoDB rejects duplicate answers.
        setPhase('waiting');
        void answerLive(pin, playerId, pending.questionIndex, pending.answer)
          .then(r => { if (r.ok || r.late) clearPendingAnswer(pin); })
          .catch(() => {});
      } else if (res.state.status === 'paused') setPhase('paused');
      else setPhase('question');
    } else {
      setPhase('lobby');
    }
  };

  useEffect(() => {
    let disposed = false;
    let failCount = 0;
    const name = localStorage.getItem('nickname') || 'Player';
    const poll = async () => {
      if (loading.current || disposed) return;
      loading.current = true;
      try {
        const res = await liveState(pin, playerId);
        if (!disposed) { applyJoined(res); setConnectionError(false); failCount = 0; }
      } catch (e) {
        if (++failCount >= 3 && !disposed) setConnectionError(true);
      } finally { loading.current = false; }
    };
    const start = async () => {
      try {
        await joinLive(pin, playerId, name);
        if (!disposed) await poll();
      } catch (e) {
        if (!disposed) {
          setConnectionError(true);
          if (e instanceof Error && /removed from this game/i.test(e.message)) setPhase('kicked');
          toast.error(e instanceof Error ? e.message : 'Cannot join live quiz.');
        }
      }
    };
    void start();
    const interval = window.setInterval(() => void poll(), 1400);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [pin, playerId]);

  const submit = async (answer: number[]) => {
    const q = questionRef.current;
    if (!q || phaseRef.current !== 'question') return;
    savePendingAnswer(pin, q.index, answer);
    setSelected(answer);
    setPhase('waiting');
    try {
      const res = await answerLive(pin, playerId, q.index, answer);
      if (res.ok || res.late) clearPendingAnswer(pin);
      if (res.late) toast('Time was up before your answer arrived.');
    } catch (e) {
      // Keep the pending answer on network failure so the poll can replay it.
      toast.error(e instanceof Error ? e.message : 'Could not submit. Retrying…');
    }
  };

  const tap = (i: number) => {
    if (!question) return;
    if (question.multi) setSelected(sel => (sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i]));
    else submit([i]);
  };

  const shell = (children: React.ReactNode) => (
    <main className="safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-5">
      <header className="mb-5 flex items-center justify-between text-sm font-semibold">
        <span className="truncate text-ink/55 dark:text-fog/55">{quizTitle || `Game ${pin}`}</span>
        <span className="flex items-center gap-2">
          {me.streak >= 2 && <span className="flex items-center gap-0.5 text-amber-dark dark:text-amber-aws"><Flame className="h-4 w-4" aria-hidden />{me.streak}</span>}
          <span className="rounded-lg bg-black/[0.05] px-2.5 py-1 font-mono tabular-nums dark:bg-white/[0.08]">{me.score.toLocaleString()}</span>
        </span>
      </header>
      {children}
    </main>
  );

  if (phase === 'connecting') return connectionError ? shell(
    <div className="card mt-10 p-6 text-center">
      <h1 className="font-bold">Unable to connect to live game</h1>
      <p className="mt-2 text-sm text-ink/60 dark:text-fog/60">Check your internet connection or check that the live quiz API is reachable.</p>
      <button onClick={() => window.location.reload()} className="btn-primary mt-5 w-full">Retry</button>
      <button onClick={() => navigate('/join')} className="btn-ghost mt-2 w-full">Back to join</button>
    </div>
  ) : <div className="grid min-h-dvh place-items-center"><Spinner className="h-8 w-8" /></div>;
  if (phase === 'kicked') return shell(
    <div className="card mt-10 p-8 text-center">
      <p className="font-bold">You were removed from this game.</p>
      <button onClick={() => navigate('/join')} className="btn-dark mt-5 w-full">Join another game</button>
    </div>
  );

  if (phase === 'lobby') return shell(
    <div className="card mt-8 flex flex-col items-center p-8 text-center">
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}
        className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-aws/15">
        <Hourglass className="h-7 w-7 text-amber-dark dark:text-amber-aws" aria-hidden />
      </motion.div>
      <p className="mt-5 text-lg font-bold">You're in!</p>
      <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">Waiting for the host to start · {playerCount} player{playerCount === 1 ? '' : 's'} joined</p>
    </div>
  );

  if ((phase === 'question' || phase === 'paused') && question) return shell(
    <>
      <div className="mb-3 flex items-center justify-between text-[13px] font-semibold text-ink/55 dark:text-fog/55">
        <span>Question {question.index + 1} / {question.total}</span>
      </div>
      {phase === 'paused'
        ? <p className="rounded-lg bg-amber-aws/15 px-4 py-2.5 text-center text-sm font-bold">Host paused the game</p>
        : <Countdown deadline={deadline} skew={skew} timeLimit={question.timeLimit} />}
      <h1 className="mt-5 text-balance text-xl font-extrabold leading-snug">{question.text}</h1>
      {question.code && <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3.5 font-mono text-[13px] leading-relaxed text-fog"><code>{question.code}</code></pre>}
      {question.imageUrl && <img src={question.imageUrl} alt="" className="mt-3 max-h-56 w-full rounded-lg object-contain" />}
      <div className="mt-5 grid flex-1 content-start gap-3">
        {question.options.map((opt, i) => (
          <button key={i} onClick={() => tap(i)} disabled={phase === 'paused'}
            aria-pressed={selected.includes(i)}
            className={`flex min-h-[60px] items-center gap-3 rounded-card border-2 px-4 py-3 text-left text-[15px] font-bold transition active:scale-[0.985] ${selected.includes(i)
              ? 'border-amber-aws bg-amber-aws/12 shadow-card'
              : 'border-black/10 bg-paper hover:border-amber-aws/50 dark:border-ink-line dark:bg-ink-soft'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink font-mono text-sm font-bold text-amber-aws dark:bg-paper dark:text-ink">{String.fromCharCode(65 + i)}</span>
            {opt}
          </button>
        ))}
      </div>
      {question.multi && (
        <button onClick={() => selected.length ? submit(selected) : toast.error('Select at least one answer.')}
          className="btn-primary sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mt-4 w-full shadow-lift" disabled={phase === 'paused'}>
          Lock in {selected.length ? `${selected.length} answer${selected.length > 1 ? 's' : ''}` : 'answers'}
        </button>
      )}
    </>
  );

  if (phase === 'waiting') return shell(
    <div className="card mt-10 flex flex-col items-center p-8 text-center">
      <Spinner className="h-6 w-6 text-amber-dark dark:text-amber-aws" />
      <p className="mt-4 font-bold">Answer locked in</p>
      <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">Waiting for everyone else…</p>
    </div>
  );

  if (phase === 'result' && result) return shell(
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card mt-8 p-7 text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${result.correct ? 'bg-amber-aws/20' : 'bg-red-600/12'}`}>
        {result.correct
          ? <Check className="h-8 w-8 text-amber-dark dark:text-amber-aws" aria-hidden />
          : <X className="h-8 w-8 text-red-600 dark:text-red-400" aria-hidden />}
      </div>
      <p className="mt-4 text-xl font-extrabold">
        {result.correct ? `+${result.points.toLocaleString()} points` : result.answered ? 'Not this time' : 'Time ran out'}
      </p>
      {result.correct && result.streak >= 2 && <p className="mt-1 text-sm font-bold text-amber-dark dark:text-amber-aws">{result.streak} in a row</p>}
      {result.rank && <p className="mt-2 text-sm font-semibold text-ink/60 dark:text-fog/60">You're in {ordinal(result.rank)} place</p>}
      {result.explanation && <p className="mt-4 rounded-lg bg-black/[0.04] px-4 py-3 text-left text-sm leading-relaxed dark:bg-white/[0.06]">{result.explanation}</p>}
      <p className="mt-4 text-[13px] text-ink/45 dark:text-fog/45">Next question coming up…</p>
    </motion.div>
  );

  if (phase === 'over') return shell(
    <div className="card mt-6 p-6">
      <p className="text-center text-lg font-extrabold">Game over</p>
      {finale && (() => {
        const mine = finale.leaderboard.find((e: any) => e.playerId === playerId);
        return mine
          ? <p className="mt-1 text-center text-sm font-semibold text-ink/60 dark:text-fog/60">You finished {ordinal(mine.rank)} with {mine.score.toLocaleString()} points</p>
          : <p className="mt-1 text-center text-sm text-ink/55 dark:text-fog/55">Final score: {me.score.toLocaleString()}</p>;
      })()}
      {finale && <div className="mt-5"><LeaderboardList entries={finale.leaderboard} highlightId={playerId} /></div>}
      <button onClick={() => navigate('/')} className="btn-dark mt-6 w-full">Done</button>
    </div>
  );

  return shell(<div className="grid flex-1 place-items-center"><Spinner className="h-7 w-7" /></div>);
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
