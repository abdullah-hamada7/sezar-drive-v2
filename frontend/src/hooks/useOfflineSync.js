import { useCallback, useEffect, useRef, useState } from 'react';
import { http } from '../services/http.service';
import { offlineQueue } from '../services/offline-queue.service';

function emitToast(message, type = 'info', code = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const offlineToastShownRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineQueue.count();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    setIsSyncing(true);
    try {
      const result = await offlineQueue.sync(http);
      await refreshPendingCount();

      if (result.synced > 0) {
        emitToast(`Synced ${result.synced} transaction${result.synced === 1 ? '' : 's'}`, 'success', 'OFFLINE_SYNCED');
      } else if (result.failed > 0) {
        emitToast('Some offline transactions could not be synced yet.', 'warning', 'OFFLINE_PARTIAL_SYNC');
      }
    } catch {
      emitToast('Unable to sync offline transactions right now.', 'warning', 'OFFLINE_SYNC_FAILED');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOffline = () => {
      setIsOnline(false);
      if (!offlineToastShownRef.current) {
        emitToast('You are offline. Changes will sync when reconnected.', 'warning', 'OFFLINE_MODE');
        offlineToastShownRef.current = true;
      }
    };

    const handleOnline = async () => {
      setIsOnline(true);
      offlineToastShownRef.current = false;
      await syncNow();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline-queue:updated', refreshPendingCount);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow();
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline-queue:updated', refreshPendingCount);
    };
  }, [refreshPendingCount, syncNow]);

  return { isOnline, isSyncing, pendingCount };
}
