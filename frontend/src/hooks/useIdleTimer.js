import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * useIdleTimer
 *
 * Monitors user activity and triggers logout after a period of inactivity.
 * Resets timer on mouse movement, key press, touch, or scroll events.
 * Provides parity with mobile's idle_timer_service.dart.
 *
 * @param {Object} options
 * @param {number} options.timeoutMinutes - Inactivity timeout in minutes (default: 30)
 * @param {boolean} options.enabled - Whether the timer is active (default: true for drivers)
 * @param {Function} options.onIdle - Callback when user becomes idle
 */
export function useIdleTimer({
  timeoutMinutes = 30,
  enabled = true,
  onIdle,
} = {}) {
  const { logout, user } = useAuth();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Only enable for drivers by default
  const isDriver = user?.role === 'driver';
  const shouldMonitor = enabled && isDriver;

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!shouldMonitor) return;

    timerRef.current = setTimeout(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= timeoutMs) {
        console.log('[IdleTimer] User idle for', timeoutMinutes, 'minutes, logging out');
        if (onIdle) {
          onIdle();
        }
        logout();
      }
    }, timeoutMs);
  }, [timeoutMs, shouldMonitor, logout, onIdle]);

  useEffect(() => {
    if (!shouldMonitor) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Activity events to monitor
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Start the timer
    resetTimer();

    // Add event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we exceeded timeout while hidden
        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime >= timeoutMs) {
          console.log('[IdleTimer] Timeout exceeded while tab hidden, logging out');
          if (onIdle) {
            onIdle();
          }
          logout();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shouldMonitor, resetTimer, logout, onIdle, timeoutMs]);

  return {
    resetTimer,
    lastActivity: () => lastActivityRef.current,
  };
}
