import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (!token) return navigate('/login?error=google', { replace: true });
    setToken(token);
    api<{ user: any }>('/auth/me')
      .then(({ user }) => { signIn(token, user); navigate('/dashboard', { replace: true }); })
      .catch(() => navigate('/login?error=google', { replace: true }));
  }, []); // eslint-disable-line

  return <div className="grid min-h-[60vh] place-items-center"><Spinner className="h-7 w-7" /></div>;
}
