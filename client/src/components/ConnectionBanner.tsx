import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getSocket } from '../lib/socket';

type Status = 'online' | 'reconnecting' | 'offline';

export function ConnectionBanner() {
  const { pathname } = useLocation();
  const live = pathname.startsWith('/host/') || pathname === '/join' || pathname.startsWith('/play/');
  const [status, setStatus] = useState<Status>('online');
  useEffect(() => {
    if (!live) return;
    const s = getSocket();
    setStatus(!navigator.onLine ? 'offline' : s.connected ? 'online' : 'reconnecting');
    const online = () => setStatus(s.connected ? 'online' : 'reconnecting');
    const offline = () => setStatus('offline');
    const connected = () => setStatus('online');
    const disconnected = () => setStatus(navigator.onLine ? 'reconnecting' : 'offline');
    s.on('connect', connected);
    s.on('disconnect', disconnected);
    s.on('connect_error', disconnected);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      s.off('connect', connected);
      s.off('disconnect', disconnected);
      s.off('connect_error', disconnected);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [live]);

  if (!live || status === 'online') return null;
  return (
    <div role="status" aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-center text-[13px] font-semibold text-paper dark:bg-amber-aws dark:text-ink">
      {status === 'offline'
        ? <><WifiOff className="h-4 w-4 shrink-0" aria-hidden /> You're offline. Reconnect to continue the live quiz.</>
        : <><RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> Connecting to the live quiz server… Check the API URL if this persists.</>}
    </div>
  );
}
