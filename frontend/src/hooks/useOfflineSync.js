import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { http } from '../services/http.service';
import { offlineQueue } from '../services/offline-queue.service';

function emitToast(message, type = 'info', code = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
}

export function useOfflineSync() {
  const { t } = useTranslation();
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
        emitToast(t('common.offline.sync_success', { count: result.synced }), 'success', 'OFFLINE_SYNCED');
        if (result.pending === 0 && typeof window !== 'undefined') {
          window.setTimeout(() => {
            const onQueuePage = String(window.location.hash || '').includes('/driver/sync');
            if (!onQueuePage) {
              window.location.reload();
            }
          }, 500);
        }
      } else if (result.failed > 0) {
        emitToast(t('common.offline.sync_partial'), 'warning', 'OFFLINE_PARTIAL_SYNC');
      }
    } catch {
      emitToast(t('common.offline.sync_failed'), 'warning', 'OFFLINE_SYNC_FAILED');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount, t]);

  useEffect(() => {
    refreshPendingCount();

    const handleOffline = () => {
      setIsOnline(false);
      if (!offlineToastShownRef.current) {
        emitToast(t('common.offline.offline_mode'), 'warning', 'OFFLINE_MODE');
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
  }, [refreshPendingCount, syncNow, t]);

  return { isOnline, isSyncing, pendingCount };
}
