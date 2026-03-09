import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { http } from '../services/http.service';
import { AuthContext } from './authContext';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
  const idleTimerRef = useRef(null);
  const navigate = useNavigate();

  const getDeviceFingerprint = () => {
    let fingerprint = localStorage.getItem('device_fingerprint');
    if (!fingerprint) {
      // crypto.randomUUID() requires a secure context (HTTPS)
      // Provide a fallback for HTTP/IP-based access
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        fingerprint = crypto.randomUUID();
      } else {
        // Simple fallback UUID generator
        fingerprint = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }
      localStorage.setItem('device_fingerprint', fingerprint);
    }
    return fingerprint;
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const res = await authService.login({ email, password, deviceFingerprint });

      if (res.data.requiresVerification) {
        // Return this so the Login page can navigate or show UI
        return { requiresVerification: true, userId: res.data.userId, deviceFingerprint };
      }

      const { user: userData, accessToken } = res.data;
      http.setTokens(accessToken);
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      if (userData.mustChangePassword) {
        navigate('/change-password');
      } else if (userData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/driver');
      }
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    http.clearTokens();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const resetIdleTimer = useCallback(() => {
    if (!user) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      http.clearTokens();
      setUser(null);
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: {
            message: 'Session ended due to inactivity. Please sign in again.',
            type: 'warning',
            code: 'SESSION_EXPIRED',
          },
        }));
      }
      navigate('/login');
    }, IDLE_TIMEOUT_MS);
  }, [navigate, user]);

  useEffect(() => {
    const handleSessionExpired = () => logout();
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [logout]);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapSession() {
      if (!user || http.getAccessToken()) return;

      const refreshed = await http.tryRefresh();
      if (!refreshed) {
        if (!isCancelled) {
          setUser(null);
          localStorage.removeItem('user');
          navigate('/login');
        }
        return;
      }

      try {
        const me = await authService.getMe();
        if (!isCancelled && me?.data?.user) {
          setUser(me.data.user);
          localStorage.setItem('user', JSON.stringify(me.data.user));
        }
      } catch {
        if (!isCancelled) {
          setUser(null);
          localStorage.removeItem('user');
          navigate('/login');
        }
      }
    }

    bootstrapSession();
    return () => { isCancelled = true; };
  }, [user, navigate]);

  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(eventName => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(eventName => window.removeEventListener(eventName, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [user, resetIdleTimer]);

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const isAdmin = user?.role === 'admin';
  const isDriver = user?.role === 'driver';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      updateUser,
      isAdmin,
      isDriver,
      isAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
