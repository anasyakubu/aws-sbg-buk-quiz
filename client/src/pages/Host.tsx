import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, SkipForward, Pause, Square, ArrowRight, Copy, Users, X } from 'lucide-react';
import { getSocket, socketAck } from '../lib/socket';
import type { LeaderboardEntry, PublicQuestion } from '../lib/types';
import { Spinner } from '../components/ui';
import { Logo } from '../components/Logo';
import { Countdown } from '../components/Countdown';
import { LeaderboardList } from '../components/Leaderboard';

type Phase = 'creating' | 'lobby' | 'question' | 'reveal' | 'paused' | 'over';
interface LobbyPlayer { playerId: string; name: string; connected: boolean; }

export default function Host() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('creating');
  const [pin, setPin] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [skew, setSkew] = useState(0);
  const [answered, setAnswered] = useState({ answered: 0, total: 0 });
  const [reveal, setReveal] = useState<{ correctIndexes: number[]; explanation?: string; isLast: boolean; stats: any } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [finale, setFinale] = useState<any>(null);
  const pinRef = useRef('');
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    let disposed = false;
    const storageKey = `hosting:${quizId}`;

    const onLobby = (data: any) => setPlayers(data.players);
    const onShow = ({ question, deadline, serverNow }: any) => {
      setSkew(serverNow - Date.now());
      setQuestion(question); setDeadline(deadline); setReveal(null);
      setAnswered({ answered: 0, total: 0 }); setPhase('question');
    };
    const onEnd = (data: any) => { setReveal(data); setPhase('reveal'); };
    const onLb = ({ leaderboard }: any) => setLeaderboard(leaderboard);
    const onCount = (data: any) => setAnswered(data);
    const onPaused = () => setPhase('paused');
    const onResumed = ({ deadline, serverNow }: any) => {
      setSkew(serverNow - Date.now()); setDeadline(deadline); setPhase('question');
    };
    const onOver = (data: any) => { setFinale(data); setPhase('over'); };

    const onConnected = async () => {
      if (disposed) return;
      setConnectionError('');
      const previousPin = pinRef.current || sessionStorage.getItem(storageKey);
      if (previousPin) {
        try {
          const res = await socketAck<any>('host:rejoin', { pin: previousPin });
          if (disposed) return;
          if (!res?.error && res?.state) {
            pinRef.current = previousPin;
            setPin(previousPin);
            setQuizTitle(res.state.quizTitle);
            setPlayers(res.state.players);
            setLeaderboard(res.leaderboard || []);
            setAnswered(res.answered || { answered: 0, total: 0 });
            if (res.activeQuestion) {
              setQuestion(res.activeQuestion.question);
              setDeadline(res.activeQuestion.deadline);
              setSkew(res.activeQuestion.serverNow - Date.now());
            }
            setReveal(res.reveal || null);
            if (res.finale) setFinale(res.finale);
            setPhase(res.state.status === 'ended' ? 'over' : res.state.status);
            return;
          }
          // Game expired or server restarted: start a fresh lobby.
          pinRef.current = '';
          sessionStorage.removeItem(storageKey);
        } catch (err) {
          if (!disposed) setConnectionError(err instanceof Error ? err.message : 'Unable to restore this game.');
          return;
        }
      }
      try {
        const res = await socketAck<any>('host:create', { quizId });
        if (disposed) return;
        if (res?.error) { toast.error(res.error); navigate('/dashboard'); return; }
        pinRef.current = res.pin;
        sessionStorage.setItem(storageKey, res.pin);
        setPin(res.pin); setQuizTitle(res.quizTitle); setPhase('lobby');
      } catch (err) {
        if (!disposed) setConnectionError(err instanceof Error ? err.message : 'Unable to connect to the live server.');
      }
    };

    socket.on('lobby:state', onLobby);
    socket.on('question:show', onShow);
    socket.on('question:end', onEnd);
    socket.on('leaderboard:update', onLb);
    socket.on('host:answer-count', onCount);
    socket.on('game:paused', onPaused);
    socket.on('game:resumed', onResumed);
    socket.on('game:over', onOver);
    socket.on('connect', onConnected);
    const initialTimeout = window.setTimeout(() => {
      if (!socket.connected && !disposed) {
        setConnectionError('The live server could not be reached.');
      }
    }, 12000);
    if (socket.connected) void onConnected();
    return () => {
      disposed = true;
      window.clearTimeout(initialTimeout);
      socket.off('lobby:state', onLobby); socket.off('question:show', onShow);
      socket.off('question:end', onEnd); socket.off('leaderboard:update', onLb);
      socket.off('host:answer-count', onCount); socket.off('game:paused', onPaused);
      socket.off('game:resumed', onResumed); socket.off('game:over', onOver);
      socket.off('connect', onConnected);
    };
  }, [quizId, navigate]);

  const cmd = async (event: string) => {
    try {
      const res = await socketAck<any>(event, { pin });
      if (res?.error) toast.error(res.error);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Command failed.'); }
  };
  const kick = async (playerId: string) => {
    try {
      const res = await socketAck<any>('host:kick', { pin, playerId });
      if (res?.error) toast.error(res.error);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to remove player.'); }
  };
  const joinUrl = `${location.origin}/join?pin=${pin}`;
  const copy = () => navigator.clipboard.writeText(joinUrl).then(() => toast.success('Invite link copied')).catch(() => toast.error('Could not copy link.')); 

  if (phase === 'creating') return connectionError ? (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-xl font-bold">Live quiz server unavailable</h1>
      <p role="alert" className="text-sm text-ink/60 dark:text-fog/60">{connectionError} Make sure VITE_API_URL points to the running Node.js backend, not a REST-only serverless API.</p>
      <button className="btn-primary" onClick={() => { setConnectionError(''); getSocket().connect(); }}>Retry connection</button>
      <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
    </main>
  ) : <div className="grid min-h-dvh place-items-center"><Spinner className="h-8 w-8" /></div>;

  return (
    <main className="safe-bottom mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-black/[0.05] px-3 py-1.5 font-mono text-sm font-bold dark:bg-white/[0.08]">PIN {pin}</span>
          {phase !== 'over' && <button onClick={() => cmd('host:end')} className="btn-danger !min-h-0 !px-3 !py-1.5 text-sm"><Square className="h-3.5 w-3.5" /> End game</button>}
        </div>
      </header>

      {phase === 'lobby' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="card flex flex-col items-center p-8 text-center">
            <p className="text-sm font-semibold text-ink/55 dark:text-fog/55">{quizTitle}</p>
            <p className="mt-3 text-[13px] font-semibold uppercase tracking-widest text-ink/45 dark:text-fog/45">Join with PIN</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.08em] min-[360px]:text-5xl min-[480px]:tracking-[0.18em] text-amber-dark dark:text-amber-aws sm:text-7xl" aria-label={`Game PIN ${pin.split('').join(' ')}`}>{pin}</p>
            <div className="mt-6 rounded-xl bg-paper p-3 shadow-card dark:bg-white">
              <QRCode value={joinUrl} size={168} aria-label="QR code to join the game" />
            </div>
            <button onClick={copy} className="btn-ghost mt-4 !min-h-0 !px-3 !py-2 text-sm"><Copy className="h-4 w-4" /> Copy invite link</button>
            <button onClick={() => cmd('host:start')} className="btn-primary mt-6 w-full max-w-xs" disabled={players.length === 0}>
              <Play className="h-4 w-4" /> Start game
            </button>
          </section>
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4" /> Players <span className="text-ink/45 dark:text-fog/45">{players.length}</span></h2>
            <ul className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto">
              <AnimatePresence>
                {players.map(p => (
                  <motion.li key={p.playerId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-between rounded-lg bg-black/[0.04] px-3 py-2 text-sm font-medium dark:bg-white/[0.06]">
                    <span className={p.connected ? '' : 'opacity-40'}>{p.name}{!p.connected && ' · reconnecting'}</span>
                    <button onClick={() => kick(p.playerId)} className="text-ink/35 transition hover:text-red-600 dark:text-fog/35" aria-label={`Remove ${p.name}`}><X className="h-4 w-4" /></button>
                  </motion.li>
                ))}
              </AnimatePresence>
              {players.length === 0 && <li className="py-8 text-center text-sm text-ink/45 dark:text-fog/45">Waiting for players to join…</li>}
            </ul>
          </section>
        </div>
      )}

      {(phase === 'question' || phase === 'paused') && question && (
        <section className="card p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-ink/55 dark:text-fog/55">
            <span>Question {question.index + 1} / {question.total}</span>
            <span>{answered.answered} / {players.length} answered</span>
          </div>
          {phase === 'question'
            ? <Countdown deadline={deadline} skew={skew} timeLimit={question.timeLimit} />
            : <p className="rounded-lg bg-amber-aws/15 px-4 py-2.5 text-center text-sm font-bold">Paused</p>}
          <h2 className="mt-5 text-balance text-2xl font-extrabold sm:text-3xl">{question.text}</h2>
          {question.code && <pre className="mt-4 overflow-x-auto rounded-lg bg-ink p-4 font-mono text-sm text-fog"><code>{question.code}</code></pre>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3.5 font-semibold dark:border-ink-line">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink font-mono text-[13px] font-bold text-amber-aws dark:bg-paper dark:text-ink">{String.fromCharCode(65 + i)}</span>
                {opt}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {phase === 'question'
              ? <><button onClick={() => cmd('host:pause')} className="btn-ghost"><Pause className="h-4 w-4" /> Pause</button>
                  <button onClick={() => cmd('host:skip')} className="btn-dark"><SkipForward className="h-4 w-4" /> Reveal now</button></>
              : <button onClick={() => cmd('host:resume')} className="btn-primary"><Play className="h-4 w-4" /> Resume</button>}
          </div>
        </section>
      )}

      {phase === 'reveal' && question && reveal && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="card p-6 sm:p-8">
            <h2 className="text-balance text-2xl font-extrabold">{question.text}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {question.options.map((opt, i) => {
                const correct = reveal.correctIndexes.includes(i);
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 font-semibold ${correct
                    ? 'border-amber-aws bg-amber-aws/15' : 'border-black/10 opacity-45 dark:border-ink-line'}`}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink font-mono text-[13px] font-bold text-amber-aws dark:bg-paper dark:text-ink">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </div>
                );
              })}
            </div>
            {reveal.explanation && <p className="mt-5 rounded-lg bg-black/[0.04] px-4 py-3 text-[15px] leading-relaxed dark:bg-white/[0.06]">{reveal.explanation}</p>}
            <p className="mt-4 text-sm font-medium text-ink/55 dark:text-fog/55">
              {reveal.stats.correct} of {reveal.stats.answered} answered correctly · avg {(reveal.stats.avgMs / 1000).toFixed(1)}s
            </p>
            <button onClick={() => cmd('host:next')} className="btn-primary mt-6 w-full sm:w-auto">
              {reveal.isLast ? 'Show final results' : 'Next question'} <ArrowRight className="h-4 w-4" />
            </button>
          </section>
          <section className="card p-5">
            <h3 className="mb-3 font-bold">Leaderboard</h3>
            <LeaderboardList entries={leaderboard} />
          </section>
        </div>
      )}

      {phase === 'over' && finale && (
        <section className="card mx-auto max-w-xl p-8 text-center">
          <p className="text-sm font-semibold text-ink/55 dark:text-fog/55">{finale.quizTitle} — final results</p>
          <div className="mt-6 flex items-end justify-center gap-3">
            {[1, 0, 2].map(slot => {
              const p = finale.podium[slot];
              if (!p) return <div key={slot} className="w-24" />;
              const heights = ['h-36', 'h-28', 'h-20'];
              return (
                <motion.div key={p.playerId} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: slot * 0.15 }} className="w-24 sm:w-28">
                  <p className="truncate text-sm font-bold">{p.name}</p>
                  <p className="font-mono text-xs text-ink/55 dark:text-fog/55">{p.score.toLocaleString()}</p>
                  <div className={`mt-2 grid ${heights[slot]} place-items-center rounded-t-lg ${slot === 0 ? 'bg-amber-aws text-ink' : 'bg-ink text-paper dark:bg-ink-soft'} text-2xl font-extrabold`}>{p.rank}</div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-8 text-left"><LeaderboardList entries={finale.leaderboard} /></div>
          <button onClick={() => navigate('/dashboard')} className="btn-dark mt-8 w-full">Back to dashboard</button>
        </section>
      )}
    </main>
  );
}
