import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';
import type { User } from '../lib/types';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const oauthToken = useRef(new URLSearchParams(window.location.hash.slice(1)).get('token'));

  useEffect(() => {
    // OAuth token is carried in the URL fragment, not the URL query string.
    // Remove it immediately from the address bar and browser history.
    const token = oauthToken.current;
    window.history.replaceState(window.history.state, '', '/oauth/callback');
    if (!token) {
      navigate('/login?error=google_failed', { replace: true });
      return;
    }
    setToken(token);
    api<{ user: User }>('/auth/me')
      .then(({ user }) => { signIn(token, user); navigate('/dashboard', { replace: true }); })
      .catch(() => { setToken(null); navigate('/login?error=google_failed', { replace: true }); });
  }, []); // Run once: StrictMode re-runs the effect but the saved token remains available.

  return <div className="grid min-h-[60vh] place-items-center"><Spinner className="h-7 w-7" /></div>;
}
