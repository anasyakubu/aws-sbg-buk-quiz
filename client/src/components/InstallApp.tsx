import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;
  const install = async () => {
    if (!prompt) return setHelp(v => !v);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setPrompt(null);
  };
  return (
    <div className="mt-5 flex w-full max-w-md flex-col items-center gap-2">
      <button type="button" onClick={install} className="btn-ghost w-full sm:w-auto">
        <Download className="h-4 w-4" aria-hidden /> Install quiz app
      </button>
      {help && (
        <p role="status" className="rounded-lg border border-black/10 bg-paper px-4 py-3 text-center text-sm dark:border-ink-line dark:bg-ink-soft">
          <Share2 className="mr-1 inline h-4 w-4" aria-hidden />
          On iPhone, open in Safari, tap Share, then <strong>Add to Home Screen</strong>.
          On Android, open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          Installation requires HTTPS and a supported browser.
        </p>
      )}
    </div>
  );
}
