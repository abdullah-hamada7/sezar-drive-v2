import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { shiftService } from '../services/shift.service';
import { useAuth } from './AuthContext';
import { realtime } from '../services/realtime.service';

interface ShiftContextType {
    activeShift: any;
    loading: boolean;
    refreshShift: () => Promise<void>;
    setActiveShift: (shift: any) => void;
}

const ShiftContext = createContext<ShiftContextType>({
    activeShift: null,
    loading: true,
    refreshShift: async () => { },
    setActiveShift: () => { },
});

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isDriver, user } = useAuth();
    const [activeShift, setActiveShift] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const refreshShift = useCallback(async () => {
        if (!isAuthenticated || !isDriver || user?.mustChangePassword) {
            setLoading(false);
            return;
        }
        try {
            const res = await shiftService.getActiveShift();
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

        // Instead of window.addEventListener for WebSockets, we'll poll every 30s as a fallback 
        // or rely on manual refresh until WS is implemented in React Native.
        const interval = setInterval(refreshShift, 30000);
        return () => clearInterval(interval);
    }, [refreshShift, isAuthenticated, isDriver, user?.mustChangePassword]);

    useEffect(() => {
        if (!isAuthenticated || !isDriver || user?.mustChangePassword) return;

        const unsubscribe = realtime.subscribe((message) => {
            if (!message?.type) return;
            if (['trip_assigned', 'trip_cancelled', 'trip_completed', 'shift_started', 'shift_activated', 'shift_closed'].includes(message.type)) {
                refreshShift();
            }
        });

        return unsubscribe;
    }, [isAuthenticated, isDriver, user?.mustChangePassword, refreshShift]);

    return (
        <ShiftContext.Provider value={{ activeShift, loading, refreshShift, setActiveShift }}>
            {children}
        </ShiftContext.Provider>
    );
};

export function useShift() {
    return useContext(ShiftContext);
}
