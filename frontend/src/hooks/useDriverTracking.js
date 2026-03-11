import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { shiftService as api } from '../services/shift.service';
import { buildTrackingWsUrl } from '../utils/trackingWs';
import { playNotificationSound } from '../utils/notificationSound';
import { evaluateRealtimeEvent, resetRealtimeStream } from '../utils/realtimeGuard';
import { http } from '../services/http.service';
import { showNativeNotification } from './usePushPermission';

const DRIVER_EVENT_MESSAGES = {
  trip_assigned: 'A new trip was assigned to you',
  trip_accepted: 'Trip accepted successfully',
  trip_completed: 'Trip completed successfully',
  trip_cancelled: 'A trip was cancelled',
  shift_started: 'Your shift request was created',
  shift_activated: 'Your shift was activated',
  shift_closed: 'Your shift was closed',
  damage_reviewed: 'Your damage report was reviewed',
  expense_reviewed: 'Your expense was reviewed',
  identity_update: 'Your identity verification status was updated',
};

// Max buffered locations when WS is offline (~10 min at 10 s intervals)
const LOCATION_BUFFER_MAX = 60;

export function useDriverTracking() {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const roleRef = useRef(user?.role || null);
  const locationBufferRef = useRef([]);

  useEffect(() => {
    roleRef.current = user?.role || null;
  }, [user?.role]);

  const connectWebSocket = useCallback(async function connectWs() {
    let token = http.getAccessToken();
    if (!token) {
      const refreshed = await http.tryRefresh();
      if (!refreshed) return;
      token = http.getAccessToken();
    }
    if (!token) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const ws = new WebSocket(buildTrackingWsUrl(token));

    ws.onopen = () => {
      console.log('Driver tracking connected');
      // Flush any locations buffered while offline
      const buffer = locationBufferRef.current;
      if (buffer.length > 0 && ws.readyState === WebSocket.OPEN) {
        buffer.forEach((msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ } });
        locationBufferRef.current = [];
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const guard = evaluateRealtimeEvent('driver', data?.type, data);

        if (guard.gapDetected && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ws:resync-required', {
            detail: { stream: 'driver', eventType: data?.type, sequence: guard.sequence, expected: guard.expected },
          }));
          window.dispatchEvent(new CustomEvent('ws:update', {
            detail: { type: 'resync_required', stream: 'driver' },
          }));
        }

        if (data.type) {
          if (DRIVER_EVENT_MESSAGES[data.type]) {
            playNotificationSound();
            window.dispatchEvent(new CustomEvent('app:toast', {
              detail: { message: DRIVER_EVENT_MESSAGES[data.type], type: 'info', code: data.type.toUpperCase() }
            }));
            // Native OS notification so drivers see it even with screen off
            showNativeNotification('Sezar Drive', DRIVER_EVENT_MESSAGES[data.type]);
          }
          // Dispatch a specific event for this message type
          window.dispatchEvent(new CustomEvent(`ws:${data.type}`, { detail: data }));
          // Dispatch a generic update event
          window.dispatchEvent(new CustomEvent('ws:update', { detail: data }));
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('Driver tracking disconnected');
      wsRef.current = null;
      if (roleRef.current === 'driver') {
        setTimeout(connectWs, 5000);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // Ignore close errors; reconnect handled in onclose.
      }
    };

    wsRef.current = ws;
  }, []);

  const startGeolocation = useCallback((shiftId, tripId) => {
    if (watchIdRef.current !== null) return; // Already watching

    if (!navigator.geolocation) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Geolocation is not supported on this device.', type: 'warning' } }));
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 10000) return;

        lastUpdateRef.current = now;

        const payload = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          recordedAt: new Date().toISOString(),
        };

        const locationMsg = { type: 'location_update', shiftId, tripId, payload };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(locationMsg));
        } else {
          // Buffer location while offline; cap at LOCATION_BUFFER_MAX
          const buf = locationBufferRef.current;
          buf.push(locationMsg);
          if (buf.length > LOCATION_BUFFER_MAX) buf.shift();
        }
      },
      (error) => {
        if (typeof window !== 'undefined') {
          const message = error?.code === 1
            ? 'Location permission denied. Enable location services to continue.'
            : 'Unable to access GPS. Please try again.';
          window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type: 'error' } }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'driver') return;

    let checkInterval;

    connectWebSocket();

    const handleOnline = () => {
      resetRealtimeStream('driver');
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    const startTracking = async () => {
      try {
        const res = await api.getActiveShift();
        const shift = res.data.shift;

        if (shift && (shift.status === 'Active' || shift.status === 'InTrip')) {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
          startGeolocation(shift.id, shift.currentTripId);
        } else {
          stopTracking();
        }
      } catch {
        stopTracking();
      }
    };

    startTracking();
    checkInterval = setInterval(startTracking, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(checkInterval);
      stopTracking();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.role, connectWebSocket, startGeolocation, stopTracking]);
}
