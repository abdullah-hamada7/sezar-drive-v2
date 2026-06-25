import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService } from '../services/notification.service';

const POLL_INTERVAL_MS = 30_000; // re-check badge every 30s in the background

/**
 * useNotificationBadge
 *
 * Manages the unseen notification badge count shown in the bottom nav.
 *
 * - `unseenCount`    : number of unread notifications (drives the badge)
 * - `markAllSeen`    : call this when the user opens the Notifications screen
 * - `refresh`        : manually re-fetch the count (e.g. after WS events)
 */
export function useNotificationBadge() {
  const [unseenCount, setUnseenCount] = useState(0);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnseenCount();
      const count = res?.data?.count ?? 0;
      if (mountedRef.current) setUnseenCount(count);
    } catch {
      // silently ignore — badge is non-critical
    }
  }, []);

  // Mark all notifications as read and reset the badge
  const markAllSeen = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      if (mountedRef.current) setUnseenCount(0);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialFetchTimer = window.setTimeout(fetchCount, 0);

    // Refresh badge when any driver WebSocket event arrives
    const handleNewNotification = () => {
      fetchCount();
    };

    window.addEventListener('ws:update', handleNewNotification);

    // Periodic background poll to stay in sync
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialFetchTimer);
      clearInterval(intervalRef.current);
      window.removeEventListener('ws:update', handleNewNotification);
    };
  }, [fetchCount]);

  return { unseenCount, markAllSeen, refresh: fetchCount };
}
