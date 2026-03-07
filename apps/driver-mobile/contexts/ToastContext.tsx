import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { http } from '../services/http.service';
import { realtime } from '../services/realtime.service';

interface Toast {
    id: string;
    message: string;
    type: 'error' | 'success' | 'warning' | 'info';
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
    toasts: [],
    addToast: () => { },
    removeToast: () => { },
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: 'error' | 'success' | 'warning' | 'info' = 'error') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3s
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useEffect(() => {
        const unsubscribe = http.subscribeToast((event) => {
            addToast(event.message, event.type);
        });
        return unsubscribe;
    }, [addToast]);

    useEffect(() => {
        const unsubscribe = realtime.subscribe((message) => {
            if (!message?.type) return;

            if (message.type === 'trip_assigned') {
                addToast('You have been assigned a new trip', 'info');
            } else if (message.type === 'trip_cancelled') {
                addToast('A trip was cancelled', 'warning');
            } else if (message.type === 'trip_completed') {
                addToast('Trip marked as completed', 'success');
            } else if (message.type === 'shift_activated') {
                addToast('Your shift has been activated', 'success');
            } else if (message.type === 'shift_closed') {
                addToast('Your shift was closed', 'warning');
            }
        });

        return unsubscribe;
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
};
