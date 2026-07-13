import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small badge that shows whenever the browser has no network connection.
 * The app itself keeps working while offline (Firestore queues writes
 * locally and the service worker serves the app shell from cache); this is
 * purely a visual reassurance so users know their entries are saved and
 * will reach the server automatically once the connection is back.
 */
export function OfflineIndicator({ compact = false }: { compact?: boolean }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

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

  if (isOnline) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
        compact ? 'px-2 py-1 text-xs' : 'mx-4 mb-3 px-3 py-2 text-sm',
      )}
      role="status"
    >
      <WifiOff className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {!compact && (
        <span>
          لا يوجد اتصال بالإنترنت — يمكنك متابعة العمل، وسيتم حفظ كل شيء ومزامنته تلقائياً عند عودة
          الاتصال.
        </span>
      )}
    </div>
  );
}
