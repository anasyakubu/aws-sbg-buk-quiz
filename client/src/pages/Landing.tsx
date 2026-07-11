import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Zap, Wifi, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length === 6) navigate(`/join?pin=${pin.trim()}`);
  };

  return (
    <main className="mx-auto max-w-5xl px-4">
      <section className="flex flex-col items-center pb-16 pt-14 text-center sm:pt-24">
        <p className="mb-4 rounded-full border border-amber-aws/40 bg-amber-aws/10 px-3.5 py-1 text-[12px] font-semibold text-amber-dark dark:text-amber-aws">
          Built for AWS Student Builder Group BUK
        </p>
        <h1 className="max-w-2xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
          Live quizzes for every session, workshop, and hackathon.
        </h1>
        <p className="mt-4 max-w-xl text-balance text-[17px] text-ink/60 dark:text-fog/60">
          Create quizzes by hand or with AI, host them live, and let the whole room compete from their phones — even on shaky campus Wi-Fi.
        </p>

        <form onSubmit={join} className="card mt-9 flex w-full max-w-md items-center gap-2 p-2" aria-label="Join a game">
          <input
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="off"
            placeholder="Game PIN"
            aria-label="Game PIN"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-center font-mono text-xl font-bold tracking-[0.35em] outline-none placeholder:tracking-normal placeholder:text-ink/35 dark:placeholder:text-fog/30"
          />
          <button className="btn-primary" disabled={pin.length !== 6}>Join</button>
        </form>

        <div className="mt-5 flex gap-3">
          {user
            ? <Link to="/dashboard" className="btn-dark">Go to dashboard</Link>
            : <><Link to="/register" className="btn-dark">Host a quiz</Link><Link to="/login" className="btn-ghost">Sign in</Link></>}
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-3">
        {[
          { icon: Sparkles, title: 'AI question writer', text: 'Generate a full quiz on any topic with Claude or OpenAI, then edit every question before it goes live.' },
          { icon: Zap, title: 'Speed scoring', text: 'Faster correct answers earn more points, with streak bonuses and an animated top-10 leaderboard.' },
          { icon: Wifi, title: 'Survives bad Wi-Fi', text: 'Answers are saved on the device and re-sent automatically. A dropped connection never loses a score.' },
        ].map(f => (
          <div key={f.title} className="card p-6">
            <f.icon className="h-6 w-6 text-amber-dark dark:text-amber-aws" aria-hidden />
            <h2 className="mt-3 font-bold">{f.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/60 dark:text-fog/60">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
