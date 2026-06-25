import { useState, useEffect, useCallback, useRef } from 'react';
import { http } from '../services/http.service';

const DEFAULT = { trips: 0, shift: 0, inspection: 0, expenses: 0, damage: 0, violations: 0 };
const POLL_MS = 30_000;

/**
 * useDriverBadges
 *
 * Fetches /api/v1/drivers/badge-counts for the current driver and returns
 * a live badge count per section. Refreshes automatically when:
 *  - WebSocket events arrive (trip assigned, cancelled, etc.)
 *  - Network comes back online
 *  - Every 30 seconds in the background
 */
export function useDriverBadges() {
  const [badges, setBadges] = useState(DEFAULT);
  const mountedRef = useRef(true);
  const intervalRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const res = await http.get('/drivers/badge-counts');
      if (mountedRef.current) {
        setBadges({
          trips:      res?.data?.trips      ?? 0,
          shift:      res?.data?.shift      ?? 0,
          inspection: res?.data?.inspection ?? 0,
          expenses:   res?.data?.expenses   ?? 0,
          damage:     res?.data?.damage     ?? 0,
          violations: res?.data?.violations ?? 0,
        });
      }
    } catch {
      // non-critical — keep showing last known counts
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();

    // Refresh badge counts when any relevant WS event fires
    const events = [
      'ws:trip_assigned', 'ws:trip_accepted', 'ws:trip_cancelled', 'ws:trip_completed',
      'ws:shift_started', 'ws:shift_activated', 'ws:shift_closed', 'ws:shift_updated',
      'ws:expense_reviewed', 'ws:damage_update', 'ws:identity_update', 'ws:violation_created',
      'ws:update', 'online',
    ];
    events.forEach(e => window.addEventListener(e, fetch));
    intervalRef.current = setInterval(fetch, POLL_MS);

    return () => {
      mountedRef.current = false;
      events.forEach(e => window.removeEventListener(e, fetch));
      clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return badges;
}
