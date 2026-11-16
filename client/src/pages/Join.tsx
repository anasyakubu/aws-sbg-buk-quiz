import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';
import { joinLive } from '../lib/live';
import { getPlayerId } from '../lib/player';
import { useAuth } from '../context/AuthContext';
import { Field, Spinner } from '../components/ui';
import { Logo } from '../components/Logo';

export default function Join() {
  const [params] = useSearchParams();
  const [pin, setPin] = useState(params.get('pin') || '');
  const [name, setName] = useState(() => localStorage.getItem('nickname') || '');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanPin = pin.trim();
    const nickname = (name || user?.name || '').trim().slice(0, 24);
    if (!/^\d{6}$/.test(cleanPin)) return toast.error('Enter the 6-digit game PIN.');
    if (!nickname) return toast.error('Pick a nickname so everyone knows who you are.');
    setBusy(true);
    try {
      await joinLive(cleanPin, getPlayerId(), nickname);
      localStorage.setItem('nickname', nickname);
      navigate(`/play/${cleanPin}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to join. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <main className="safe-bottom mx-auto flex max-w-md flex-col items-center px-4 pt-8 sm:pt-12">
      <Logo size={44} />
      <form onSubmit={join} className="card mt-8 w-full space-y-4 p-6">
        <Field label="Game PIN" htmlFor="pin">
          <input id="pin" inputMode="numeric" autoComplete="off" className="input text-center font-mono text-2xl font-bold tracking-[0.35em]"
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </Field>
        <Field label="Nickname" htmlFor="nick">
          <input id="nick" maxLength={24} className="input" placeholder={user?.name || 'e.g. CloudNinja'} value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : <>Join game <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
      <p className="mt-4 text-center text-[13px] text-ink/50 dark:text-fog/50">
        If your connection drops mid-game, just come back — your score is safe.
      </p>
    </main>
  );
}
