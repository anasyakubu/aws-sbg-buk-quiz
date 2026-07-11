import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Field, Spinner } from '../components/ui';
import { GoogleButton } from '../components/GoogleButton';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    setBusy(true);
    try {
      const { token, user } = await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      signIn(token, user);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 pt-12">
      <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink/55 dark:text-fog/55">Host live quizzes for your next SBG BUK session.</p>
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
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Create account'}</button>
        <GoogleButton />
      </form>
      <p className="mt-5 text-center text-sm text-ink/60 dark:text-fog/60">
        Already registered? <Link to="/login" className="font-semibold text-amber-dark hover:underline dark:text-amber-aws">Sign in</Link>
      </p>
    </main>
  );
}
