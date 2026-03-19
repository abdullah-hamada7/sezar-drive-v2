import { offlineQueue } from './offline-queue.service';
import { readCache } from './read-cache.service';
import i18n from '../i18n';

const API_BASE =
  import.meta.env.VITE_API_URL || '/api/v1';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const CACHEABLE_GET_PATTERNS = [
  /^\/trips(?:$|\?|\/[^/?]+(?:\?|$))/,
  /^\/shifts\/active(?:$|\?)/,
  /^\/shifts(?:$|\?)/,
  /^\/expenses(?:$|\?)/,
  /^\/expenses\/categories(?:$|\?)/,
  /^\/inspections(?:$|\?)/,
  /^\/damage-reports(?:$|\?|\/[^/?]+(?:\?|$))/,
  /^\/drivers(?:$|\?|\/[^/?]+(?:\?|$))/,
  /^\/vehicles(?:$|\?|\/[^/?]+(?:\?|$))/,
  /^\/audit-logs(?:$|\?)/,
  /^\/stats(?:$|\/|\?)/,
  /^\/tracking(?:$|\/|\?)/,
  /^\/reports(?:$|\/|\?)/,
  /^\/verify\/pending(?:$|\?)/,
  /^\/auth\/identity\/pending(?:$|\?)/,
  /^\/auth\/admin\/rescue\/pending(?:$|\?)/,
  /^\/admins(?:$|\?|\/[^/?]+(?:\?|$))/,
  /^\/auth\/me(?:$|\?)/,
];
const BLOCKED_OFFLINE_PATTERNS = [
  { method: 'POST', pattern: /^\/verify\/shift-selfie(?:$|\?)/ },
  { method: 'POST', pattern: /^\/shifts(?:$|\?)/ },
  { method: 'POST', pattern: /^\/trips(?:$|\?)/ },
];

function stripQuery(endpoint) {
  return String(endpoint || '').split('?')[0] || '';
}

function isCacheableGetEndpoint(endpoint) {
  return CACHEABLE_GET_PATTERNS.some((pattern) => pattern.test(endpoint));
}

function isBlockedOfflineWrite(method, endpoint) {
  return BLOCKED_OFFLINE_PATTERNS.some(
    (entry) => entry.method === method && entry.pattern.test(endpoint),
  );
}

class HttpService {
  constructor() {
    this.accessToken = null;
  }

  setTokens(access) {
    this.accessToken = access;
  }

  clearTokens() {
    this.accessToken = null;
    localStorage.removeItem('user');
    readCache.clear().catch(() => {});
  }

  getAccessToken() {
    return this.accessToken;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const requestOptions = { ...options };
    const method = String(requestOptions.method || 'GET').toUpperCase();
    const endpointPath = stripQuery(endpoint);
    const headers = { ...(requestOptions.headers || {}) };
    const rawBody = requestOptions.body;
    const isFormDataBody = rawBody instanceof FormData;

    const dispatchToast = (message, type = 'error', code = null) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
    };

    const notifyToast = (message, type = 'error', code = null) => {
      if (requestOptions.suppressToast || requestOptions.toast !== true) return;
      dispatchToast(message, type, code);
    };

    // Intentionally no global browser confirm() prompts.

    if (this.accessToken && !requestOptions.skipAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (requestOptions.body && !isFormDataBody) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(requestOptions.body);
    }

    let response;
    try {
      response = await fetch(url, { ...requestOptions, method, headers, credentials: 'include' });
    } catch (err) {
      err.isNetworkError = true;
      err.code = 'NETWORK_ERROR';

      if (method === 'GET') {
        try {
          const cached = await readCache.get(endpoint);
          if (cached) {
            return { data: cached.data, fromCache: true };
          }
        } catch {
          // Ignore cache failures and preserve normal network error behavior.
        }
      }

      const shouldHandleAsOfflineWrite =
        WRITE_METHODS.includes(method)
        && !requestOptions.skipOfflineQueue
        && !requestOptions.skipAuth;

      if (shouldHandleAsOfflineWrite) {
        if (isFormDataBody || isBlockedOfflineWrite(method, endpointPath)) {
          const blocked = new Error(i18n.t('common.offline.action_requires_connection'));
          blocked.isNetworkError = true;
          blocked.code = 'BLOCKED_OFFLINE';
          dispatchToast(blocked.message, 'warning', 'BLOCKED_OFFLINE');
          throw blocked;
        }

        try {
          await offlineQueue.enqueue({
            idempotencyKey: headers['Idempotency-Key'] || headers['idempotency-key'] || null,
            endpoint,
            method,
            body: rawBody || null,
            headers,
          });
        } catch {
          notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
          throw err;
        }
        dispatchToast(i18n.t('common.offline.saved_will_sync'), 'info', 'QUEUED_OFFLINE');
        return { data: null, queued: true };
      }

      notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
      throw err;
    }

    const notifySessionExpired = () => {
      this.clearTokens();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }
    };

    // Token refresh on 401
    if (response.status === 401 && !requestOptions._retried && !requestOptions.skipAuth) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        try {
          response = await fetch(url, { ...requestOptions, method, headers, credentials: 'include', _retried: true });
        } catch (err) {
          notifyToast('Network error. Please check your connection and try again.', 'error', 'NETWORK_ERROR');
          err.isNetworkError = true;
          err.code = 'NETWORK_ERROR';
          throw err;
        }
      } else {
        notifySessionExpired();
      }
    } else if (response.status === 401 && !requestOptions.skipAuth) {
      notifySessionExpired();
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
      if (method === 'GET' && isCacheableGetEndpoint(endpointPath)) {
        readCache.set(endpoint, json).catch(() => {});
      }
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
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.accessToken);
      return true;
    } catch {
      return false;
    }
  }
}

export const http = new HttpService();
