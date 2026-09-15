import { useState, useEffect } from 'react';
import { WifiOff, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '../../lib/api/client';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCheckConnection = async () => {
    setIsChecking(true);
    try {
      // Ping lightweight health endpoint
      await api.get('/health').catch(() => fetch('/api/health', { method: 'HEAD', cache: 'no-store' }));
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold shadow-md animate-in slide-in-from-top duration-200"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="size-4 shrink-0" />
        <span>You are currently offline. Some live actions and data synchronizations are temporarily paused.</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleCheckConnection}
        disabled={isChecking}
        leftIcon={<RotateCcw className={`size-3.5 ${isChecking ? 'animate-spin' : ''}`} />}
        className="bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 text-xs px-2.5 py-1 rounded-md"
      >
        {isChecking ? 'Checking...' : 'Check Connection'}
      </Button>
    </div>
  );
}

export default OfflineBanner;
