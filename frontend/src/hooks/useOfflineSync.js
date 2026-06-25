import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { http } from '../services/http.service';
import { offlineQueue } from '../services/offline-queue.service';

function emitToast(message, type = 'info', code = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
}

/**
 * useOfflineSync
 *
 * Manages offline queue synchronization with parity to mobile's BackgroundSyncService.
 * - Syncs when coming back online
 * - Syncs when tab becomes visible (visibilitychange)
 * - Periodic sync every 15 minutes when page is visible (mobile parity)
 * - Sync on initial mount if online
 */
export function useOfflineSync() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const offlineToastShownRef = useRef(false);
  const periodicSyncRef = useRef(null);
  const lastSyncRef = useRef(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineQueue.count();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async (options = {}) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    // Prevent duplicate syncs within 5 seconds
    const now = Date.now();
    if (!options.force && now - lastSyncRef.current < 5000) return;
    lastSyncRef.current = now;

    setIsSyncing(true);
    try {
      const result = await offlineQueue.sync(http);
      await refreshPendingCount();

      if (result.synced > 0 && !options.silent) {
        emitToast(t('common.offline.sync_success', { count: result.synced }), 'success', 'OFFLINE_SYNCED');
        if (result.pending === 0 && typeof window !== 'undefined') {
          window.setTimeout(() => {
            const onQueuePage = String(window.location.hash || '').includes('/driver/sync');
            if (!onQueuePage) {
              window.location.reload();
            }
          }, 500);
        }
      } else if (result.failed > 0 && !options.silent) {
        emitToast(t('common.offline.sync_partial'), 'warning', 'OFFLINE_PARTIAL_SYNC');
      }
    } catch {
      if (!options.silent) {
        emitToast(t('common.offline.sync_failed'), 'warning', 'OFFLINE_SYNC_FAILED');
      }
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

    // Visibility change handling - sync when tab becomes visible
    // This provides parity with mobile's background sync when app resumes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - check if we need to sync
        const timeSinceLastSync = Date.now() - lastSyncRef.current;
        // Sync if more than 30 seconds since last sync (mobile-like behavior)
        if (timeSinceLastSync > 30000 && navigator.onLine) {
          syncNow({ silent: true });
        }
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline-queue:updated', refreshPendingCount);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic sync every 15 minutes (parity with mobile's BackgroundSyncService)
    // Only runs when page is visible to conserve resources
    periodicSyncRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow({ silent: true });
      }
    }, 15 * 60 * 1000); // 15 minutes

    // Initial sync on mount
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow({ silent: true });
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline-queue:updated', refreshPendingCount);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (periodicSyncRef.current) {
        clearInterval(periodicSyncRef.current);
      }
    };
  }, [refreshPendingCount, syncNow, t]);

  return { isOnline, isSyncing, pendingCount };
}
