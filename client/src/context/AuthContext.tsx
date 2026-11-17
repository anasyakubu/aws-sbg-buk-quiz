import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken } from '../lib/api';
// import { resetSocket } from '../lib/socket';
import type { User } from '../lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api<{ user: User }>('/auth/me')
      .then(({ user }) => { setUser(user); localStorage.setItem('user', JSON.stringify(user)); })
      .catch(() => { setUser(null); localStorage.removeItem('user'); })
      .finally(() => setLoading(false));
  }, []);

  const signIn = (token: string, u: User) => {
    setToken(token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    //resetSocket(); // reconnect socket with the new token
  };

  const signOut = () => {
    setToken(null);
    localStorage.removeItem('user');
    setUser(null);
    // resetSocket();
  };

  const refresh = async () => {
    const { user: u } = await api<{ user: User }>('/auth/me');
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
  };

  return <Ctx.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}
