import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Field, Spinner } from '../components/ui';
import { GoogleButton } from '../components/GoogleButton';
import { googleErrorMessage } from '../lib/authErrors';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const googleError = googleErrorMessage(params.get('error'));
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    setBusy(true);
    setError('');
    const payload = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), department: form.department.trim() };
    try {
      const { token, user } = await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      signIn(token, user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 pt-12">
      <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">Host live quizzes for your next SBG BUK session.</p>
      {googleError && <p role="alert" className="mt-4 rounded-lg bg-red-600/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">{googleError}</p>}
      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <Field label="Full name" htmlFor="name">
          <input id="name" required autoComplete="name" className="input" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" htmlFor="remail">
          <input id="remail" type="email" required autoComplete="email" className="input" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" htmlFor="rpassword">
          <input id="rpassword" type="password" required minLength={8} autoComplete="new-password" className="input" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Department (optional)" htmlFor="dept">
          <input id="dept" className="input" placeholder="e.g. Computer Science" value={form.department} onChange={set('department')} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Create account'}</button>
        <GoogleButton from="register" />
      </form>
      <p className="mt-5 text-center text-sm text-ink/60 dark:text-fog/60">
        Already registered? <Link to="/login" className="font-semibold text-amber-dark hover:underline dark:text-amber-aws">Sign in</Link>
      </p>
    </main>
  );
}
