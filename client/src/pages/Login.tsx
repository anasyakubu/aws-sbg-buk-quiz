import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Field, Spinner } from '../components/ui';
import { GoogleButton } from '../components/GoogleButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      signIn(token, user);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 pt-12">
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">Sign in to create and host quizzes.</p>
      {params.get('error') === 'google' && (
        <p role="alert" className="mt-4 rounded-lg bg-red-600/10 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-400">
          Google sign-in didn't complete. Try again or use your email.
        </p>
      )}
      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
        <GoogleButton />
      </form>
      <p className="mt-5 text-center text-sm text-ink/60 dark:text-fog/60">
        New here? <Link to="/register" className="font-semibold text-amber-dark hover:underline dark:text-amber-aws">Create an account</Link>
      </p>
    </main>
  );
}
