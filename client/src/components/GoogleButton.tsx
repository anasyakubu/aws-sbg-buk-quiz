import { useEffect, useState } from 'react';
import { API_ORIGIN, api } from '../lib/api';

export function GoogleButton({ from = 'login' }: { from?: 'register' | 'login' }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let mounted = true;
    api<{ google: boolean }>('/auth/providers')
      .then(({ google }) => {
        if (!mounted) return;
        setEnabled(Boolean(google));
        setReason(google ? '' : 'Google sign-in needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SERVER_URL on your Vercel API.');
      })
      .catch((err: Error) => {
        if (!mounted) return;
        setEnabled(false);
        setReason(`Unable to check Google sign-in: ${err.message}`);
      });
    return () => { mounted = false; };
  }, []);

  const contents = <>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.18 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.27a7.21 7.21 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44A11.98 11.98 0 0 0 1.27 6.63l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
    {enabled === null ? 'Checking Google sign-in…' : 'Continue with Google'}
  </>;

  return <div className="space-y-2">
    {enabled ? (
      <a href={`${API_ORIGIN}/api/auth/google?from=${from}`} className="btn-ghost flex w-full items-center justify-center gap-2">{contents}</a>
    ) : (
      <button type="button" disabled className="btn-ghost flex w-full cursor-not-allowed items-center justify-center gap-2 opacity-60">{contents}</button>
    )}
    {reason && <p role="status" className="text-xs text-red-700 dark:text-red-400">{reason}</p>}
  </div>;
}
