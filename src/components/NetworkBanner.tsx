import { useEffect, useState, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Indicateur de connexion réseau (CONF-29) — crucial sur les réseaux 3G
 * instables : l'utilisateur doit savoir que ses actions ne partiront pas.
 * Bannière fixe sous le header quand `navigator.onLine` passe à false,
 * toast de confirmation au retour de la connexion.
 */
export default function NetworkBanner({ topOffset = 72 }: { topOffset?: number }) {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const wasOffline = useRef(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => {
      wasOffline.current = true;
      setOffline(true);
    };
    const handleOnline = () => {
      setOffline(false);
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success('Connexion rétablie');
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{ top: topOffset }}
      className="fixed left-0 right-0 z-[60] bg-error text-white text-center text-sm font-inter font-medium px-4 py-2 flex items-center justify-center gap-2"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      Hors connexion — vos actions seront envoyées quand le réseau reviendra.
    </div>
  );
}
