import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { shiftService as api } from '../services/shift.service';
import { buildTrackingWsUrl } from '../utils/trackingWs';

export function useDriverTracking() {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const roleRef = useRef(user?.role || null);

  useEffect(() => {
    roleRef.current = user?.role || null;
  }, [user?.role]);

  const connectWebSocket = useCallback(function connectWs() {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const ws = new WebSocket(buildTrackingWsUrl(token));

    ws.onopen = () => {
      console.log('Driver tracking connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type) {
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

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'location_update',
            shiftId,
            tripId,
            payload
          }));
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
      clearInterval(checkInterval);
      stopTracking();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.role, connectWebSocket, startGeolocation, stopTracking]);
}
