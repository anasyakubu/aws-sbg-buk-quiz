import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';
import { getSocket } from '../lib/socket';
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

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const nickname = (name || user?.name || '').trim();
    if (pin.length !== 6) return toast.error('Enter the 6-digit game PIN.');
    if (!nickname) return toast.error('Pick a nickname so everyone knows who you are.');
    setBusy(true);
    localStorage.setItem('nickname', nickname);
    const socket = getSocket();
    const doJoin = () => socket.emit('player:join', { pin, playerId: getPlayerId(), name: nickname }, (res: any) => {
      setBusy(false);
      if (res?.error) return toast.error(res.error);
      navigate(`/play/${pin}`, { state: { joined: res } });
    });
    socket.connected ? doJoin() : (socket.once('connect', doJoin), socket.connect());
  };

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-12">
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
