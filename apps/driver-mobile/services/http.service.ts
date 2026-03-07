export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class HttpService {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private listeners: ((event: { message: string, type: 'error' | 'success' | 'warning' | 'info', code?: string }) => void)[] = [];

    constructor() {
        this.initTokens();
    }

    private async initTokens() {
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            this.accessToken = await AsyncStorage.getItem('accessToken');
            this.refreshToken = await AsyncStorage.getItem('refreshToken');
        } catch (e) {
            console.error('Failed to load tokens', e);
        }
    }

    async setTokens(access: string, refresh?: string) {
        this.accessToken = access;
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.setItem('accessToken', access);
            if (refresh) {
                this.refreshToken = refresh;
                await AsyncStorage.setItem('refreshToken', refresh);
            }
        } catch (e) {
            console.error('Failed to save tokens', e);
        }
    }

    async clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.removeItem('accessToken');
            await AsyncStorage.removeItem('refreshToken');
            await AsyncStorage.removeItem('user');
        } catch (e) {
            console.error('Failed to clear tokens', e);
        }
    }

    getAccessToken() {
        return this.accessToken;
    }

    subscribeToast(listener: (event: any) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private notifyToast(message: string, type: 'error' | 'success' | 'warning' | 'info' = 'error', code?: string) {
        this.listeners.forEach((listener) => listener({ message, type, code }));
    }

    async request(endpoint: string, options: any = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = { ...options.headers };

        if (this.accessToken && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        let response;
        try {
            response = await fetch(url, { ...options, headers });
        } catch (err: any) {
            this.notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
            err.isNetworkError = true;
            err.code = 'NETWORK_ERROR';
            throw err;
        }

        // Token refresh on 401
        if (response.status === 401 && this.refreshToken && !options._retried) {
            const refreshed = await this.tryRefresh();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
                try {
                    response = await fetch(url, { ...options, headers, _retried: true });
                } catch (err: any) {
                    this.notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
                    err.isNetworkError = true;
                    err.code = 'NETWORK_ERROR';
                    throw err;
                }
            }
        }

        let data;
        try {
            data = await response.clone().json();
        } catch (e) {
            data = { message: response.statusText };
        }

        if (!response.ok) {
            const code = data.error?.code || data.code || 'UNKNOWN_ERROR';
            let message = data.error?.message || data.message || 'Request failed';

            // If there are validation details, append them
            if (data.error?.details && Array.isArray(data.error.details)) {
                const details = data.error.details.map((d: any) => `${d.path}: ${d.msg}`).join(', ');
                message += ` (${details})`;
            }

            const type = response.status >= 500 ? 'error' : 'warning';
            if (!options.suppressToast && options.toast !== false) {
                this.notifyToast(message, type, code);
            }
            const err: any = new Error(message);
            err.status = response.status;
            err.code = code;
            err.details = data.error?.details || data.details;
            throw err;
        }

        return { data };
    }

    async get(endpoint: string, options: any = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint: string, body?: any, options: any = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body });
    }

    async put(endpoint: string, body?: any, options: any = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body });
    }

    async patch(endpoint: string, body?: any, options: any = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', body });
    }

    async delete(endpoint: string, options: any = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    async tryRefresh() {
        try {
            const res = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken }),
            });
            if (!res.ok) return false;
            const data = await res.json();
            await this.setTokens(data.accessToken, data.refreshToken);
            return true;
        } catch {
            return false;
        }
    }
}

export const http = new HttpService();
