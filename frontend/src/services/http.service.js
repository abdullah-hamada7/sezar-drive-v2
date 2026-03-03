const API_BASE =
  import.meta.env.VITE_API_URL || '/api/v1';

class HttpService {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...options.headers };

    const notifyToast = (message, type = 'error', code = null) => {
      if (options.suppressToast || options.toast !== true) return;
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
    };

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
    } catch (err) {
      notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
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
        } catch (err) {
          notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
          err.isNetworkError = true;
          err.code = 'NETWORK_ERROR';
          throw err;
        }
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      const code = error.error?.code || error.code || 'UNKNOWN_ERROR';
      let message = error.error?.message || error.message || 'Request failed';

      // If there are validation details, append them
      if (error.error?.details && Array.isArray(error.error.details)) {
        const details = error.error.details.map(d => `${d.path}: ${d.msg}`).join(', ');
        message += ` (${details})`;
      }

      notifyToast(message, response.status >= 500 ? 'error' : 'warning', code);
      const err = new Error(message);
      err.status = response.status;
      err.code = code;
      err.details = error.error?.details || error.details;
      throw err;
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      const json = await response.json();
      return { data: json };
    }
    return response;
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  async patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete(endpoint, options = {}) {
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
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }
}

export const http = new HttpService();
