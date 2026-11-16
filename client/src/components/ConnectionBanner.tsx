import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';

type Status = 'online' | 'reconnecting' | 'offline';
export function ConnectionBanner() {
  const { pathname } = useLocation();
  const live = pathname.startsWith('/host/') || pathname === '/join' || pathname.startsWith('/play/');
  const [status, setStatus] = useState<Status>('online');
  useEffect(() => {
    if (!live) return;
    const online = () => setStatus('online');
    const offline = () => setStatus('offline');
    const update = (e: Event) => {
      setStatus(!navigator.onLine ? 'offline' : (e as CustomEvent<Status>).detail);
    };
    if (!navigator.onLine) offline();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('live:connection', update);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('live:connection', update);
    };
  }, [live]);
  if (!live || status === 'online') return null;
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-center text-[13px] font-semibold text-paper dark:bg-amber-aws dark:text-ink">
      {status === 'offline'
        ? <><WifiOff className="h-4 w-4 shrink-0" aria-hidden /> You're offline. Reconnect to continue the live quiz.</>
        : <><RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> Refreshing live quiz state from the API…</>}
    </div>
  );
}
