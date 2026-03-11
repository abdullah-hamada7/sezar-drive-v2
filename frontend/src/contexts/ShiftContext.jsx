/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { shiftService as api } from '../services/shift.service';
import { useAuth } from '../hooks/useAuth';

const ShiftContext = createContext();

export function ShiftProvider({ children }) {
  const { isAuthenticated, isDriver, user } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshShift = useCallback(async () => {
    if (!isAuthenticated || !isDriver || user?.mustChangePassword) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.getActiveShift();
      setActiveShift(res.data.shift);
    } catch {
      setActiveShift(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isDriver, user?.mustChangePassword]);

  useEffect(() => {
    if (!isAuthenticated || !isDriver || user?.mustChangePassword) return;

    refreshShift();
    const poll = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      refreshShift();
    }, 20000);

    // Listen for shift-related WebSocket events
    const handleShiftUpdate = () => refreshShift();
    const handleShiftClosed = () => setActiveShift(null);
    const handleOnline = () => refreshShift();
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      refreshShift();
    };

    window.addEventListener('ws:shift_started', handleShiftUpdate);
    window.addEventListener('ws:shift_activated', handleShiftUpdate);
    window.addEventListener('ws:shift_closed', handleShiftClosed);
    window.addEventListener('ws:trip_assigned', handleShiftUpdate); // Refresh to show assignment
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('ws:shift_started', handleShiftUpdate);
      window.removeEventListener('ws:shift_activated', handleShiftUpdate);
      window.removeEventListener('ws:shift_closed', handleShiftClosed);
      window.removeEventListener('ws:trip_assigned', handleShiftUpdate);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshShift, isAuthenticated, isDriver, user?.mustChangePassword]);

  return (
    <ShiftContext.Provider value={{ activeShift, loading, refreshShift, setActiveShift }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
}
