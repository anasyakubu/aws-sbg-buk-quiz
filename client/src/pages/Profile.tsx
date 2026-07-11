import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Field, Spinner } from '../components/ui';

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', institution: user?.institution || '',
    department: user?.department || '', skillLevel: user?.skillLevel || 'beginner',
    avatarUrl: user?.avatarUrl || '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('profile');
    try {
      await api('/auth/profile', { method: 'PATCH', body: JSON.stringify(form) }, false);
      await refresh();
      toast.success('Profile saved');
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(null); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword.length < 8) return toast.error('New password must be at least 8 characters.');
    setBusy('password');
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify(pw) }, false);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(null); }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink text-xl font-extrabold text-amber-aws dark:bg-paper dark:text-ink">
          {form.avatarUrl ? <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user?.name?.[0] || '?').toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{user?.name}</h1>
          <p className="text-sm text-ink/55 dark:text-fog/55">{user?.email}</p>
        </div>
      </div>

      <form onSubmit={saveProfile} className="card mt-6 space-y-4 p-6">
        <h2 className="font-bold">Profile</h2>
        <Field label="Display name" htmlFor="pname">
          <input id="pname" required minLength={2} className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institution" htmlFor="inst">
            <input id="inst" className="input" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
          </Field>
          <Field label="Department" htmlFor="pdept">
            <input id="pdept" className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Skill level" htmlFor="skill">
            <select id="skill" className="input" value={form.skillLevel} onChange={e => setForm(f => ({ ...f, skillLevel: e.target.value }))}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Avatar image URL" htmlFor="avatar">
            <input id="avatar" type="url" className="input" placeholder="https://…" value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))} />
          </Field>
        </div>
        <button className="btn-primary w-full" disabled={busy === 'profile'}>{busy === 'profile' ? <Spinner /> : 'Save profile'}</button>
      </form>

      <form onSubmit={savePassword} className="card mt-5 space-y-4 p-6">
        <h2 className="font-bold">Change password</h2>
        <Field label="Current password" htmlFor="cur">
          <input id="cur" type="password" autoComplete="current-password" className="input" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} />
        </Field>
        <Field label="New password" htmlFor="new">
          <input id="new" type="password" required minLength={8} autoComplete="new-password" className="input" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} />
        </Field>
        <button className="btn-dark w-full" disabled={busy === 'password'}>{busy === 'password' ? <Spinner /> : 'Change password'}</button>
      </form>
    </main>
  );
}
