import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { http } from '../services/http.service';
import { AuthContext } from './authContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
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

      const { user: userData, accessToken, refreshToken } = res.data;
      http.setTokens(accessToken, refreshToken);
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
