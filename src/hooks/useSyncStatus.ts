import { useEffect, useState } from 'react';
import { syncManager } from '../lib/syncManager';

export function useSyncStatus() {
  const [status, setStatus] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
  });

  useEffect(() => {
    return syncManager.subscribe((next) => {
      setStatus(next);
    });
  }, []);

  return status;
}
