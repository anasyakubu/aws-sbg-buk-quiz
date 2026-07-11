import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getSocket } from '../lib/socket';

type Status = 'online' | 'reconnecting' | 'offline';

export function ConnectionBanner() {
  const [status, setStatus] = useState<Status>('online');

  useEffect(() => {
    const socket = getSocket();
    const onDisconnect = () => setStatus(navigator.onLine ? 'reconnecting' : 'offline');
    const onConnect = () => setStatus('online');
    const onOffline = () => setStatus('offline');
    const onOnline = () => setStatus(socket.connected ? 'online' : 'reconnecting');
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.io.on('reconnect_attempt', onDisconnect);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.io.off('reconnect_attempt', onDisconnect);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (status === 'online') return null;
  return (
    <div role="status" aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper dark:bg-amber-aws dark:text-ink">
      {status === 'offline'
        ? <><WifiOff className="h-4 w-4" aria-hidden /> You're offline. Your answers are saved and will send when you're back.</>
        : <><RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Connection dropped — reconnecting…</>}
    </div>
  );
}
