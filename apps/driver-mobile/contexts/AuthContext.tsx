import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth.service';
import { http } from '../services/http.service';
import { realtime } from '../services/realtime.service';

interface User {
    id: string | number;
    email: string;
    name?: string;
    role: string;
    mustChangePassword?: boolean;
    languagePreference?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    profilePhotoUrl?: string;
    identityVerified?: boolean;
    phone?: string;
    licenseNumber?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<any>;
    logout: () => void;
    updateUser: (updates: Partial<User>) => void;
    isAdmin: boolean;
    isDriver: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => { },
    logout: () => { },
    updateUser: () => { },
    isAdmin: false,
    isDriver: false,
    isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    // Load user from storage on mount
    useEffect(() => {
        const loadUser = async () => {
            try {
                const stored = await AsyncStorage.getItem('user');
                if (stored) {
                    setUser(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Failed to load user', e);
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, []);

    // Basic navigation guard
    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(tabs)';

        if (!user && inAuthGroup) {
            // Redirect to the sign-in page.
            router.replace('/login');
        } else if (user && !inAuthGroup && segments[0] !== 'change-password' && segments[0] !== 'verify-device') {
            // Redirect to the main app if authenticated and trying to access auth screens
            if (user.role === 'driver') {
                if (user.mustChangePassword) {
                    router.replace('/change-password');
                } else {
                    router.replace('/(tabs)');
                }
            }
        }
    }, [user, segments, loading]);

    useEffect(() => {
        let cancelled = false;

        const connectRealtime = async () => {
            if (!user || user.role !== 'driver') {
                realtime.disconnect();
                return;
            }

            let token = http.getAccessToken();
            if (!token) {
                token = await AsyncStorage.getItem('accessToken');
            }

            if (!cancelled && token) {
                realtime.connect(token);
            }
        };

        connectRealtime();
        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.role]);

    const getDeviceFingerprint = async () => {
        let fingerprint = await AsyncStorage.getItem('device_fingerprint');
        if (!fingerprint) {
            fingerprint = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
            await AsyncStorage.setItem('device_fingerprint', fingerprint);
        }
        return fingerprint;
    };

    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            const deviceFingerprint = await getDeviceFingerprint();
            const res = await authService.login({ email, password, deviceFingerprint });

            if (res.data.requiresVerification) {
                return { requiresVerification: true, userId: res.data.userId, deviceFingerprint };
            }

            const { user: userData, accessToken, refreshToken } = res.data;
            await http.setTokens(accessToken, refreshToken);
            setUser(userData);
            await AsyncStorage.setItem('user', JSON.stringify(userData));

            if (userData.mustChangePassword) {
                router.replace('/change-password');
            } else if (userData.role === 'driver') {
                router.replace('/(tabs)');
            }
            return userData;
        } finally {
            setLoading(false);
        }
    };

    const logout = useCallback(async () => {
        realtime.disconnect();
        await http.clearTokens();
        setUser(null);
        router.replace('/login');
    }, [router]);

    const updateUser = async (updates: Partial<User>) => {
        if (!user) return;
        const updated = { ...user, ...updates };
        setUser(updated);
        await AsyncStorage.setItem('user', JSON.stringify(updated));
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
};
