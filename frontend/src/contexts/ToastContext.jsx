import { useState, useRef } from 'react';
import Toast from '../components/Toast';
import { ToastContext } from './toastContext';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const lastToastRef = useRef({ message: '', time: 0 });

  function addToast(message, type = 'info', duration = 5000) {
    const now = Date.now();
    const last = lastToastRef.current;
    if (last.message === message && now - last.time < 3000) {
      return;
    }
    lastToastRef.current = { message, time: now };
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
