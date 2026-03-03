export function buildTrackingWsUrl(token) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const isAbsolute = apiBase.startsWith('http');

  let host = window.location.host;
  let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (isAbsolute) {
    try {
      const url = new URL(apiBase);
      host = url.host;
      protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    } catch {
      console.error('[WebSocket] Invalid VITE_API_URL:', apiBase);
    }
  }

  const wsUrl = `${protocol}//${host}/ws/tracking?token=${encodeURIComponent(token)}`;

  if (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[WebSocket] Connecting:', { wsUrl, apiBase, isAbsolute, derivedHost: host });
  }

  return wsUrl;
}
