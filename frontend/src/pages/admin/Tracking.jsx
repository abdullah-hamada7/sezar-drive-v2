import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Radio } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ToastContext } from '../../contexts/toastContext';
import { buildTrackingWsUrl } from '../../utils/trackingWs';
import { evaluateRealtimeEvent, resetRealtimeStream } from '../../utils/realtimeGuard';
import { http } from '../../services/http.service';
import { ListEmpty, ListError, ListLoading } from '../../components/common/ListStates';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center);
  }, [center, map]);
  return null;
}

const DRIVER_MARKER_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#a855f7', // purple
  '#14b8a6', // teal
  '#ec4899', // pink
  '#6366f1', // indigo
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#f97316', // orange
  '#0ea5e9', // sky
];

function createDriverMarkerIcon({ color, label }) {
  const safeLabel = (label || '').slice(0, 2).toUpperCase();
  return L.divIcon({
    className: 'driver-dot-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: ${color};
        border: 2px solid rgba(255, 255, 255, 0.95);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        color: #ffffff;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      ">
        ${safeLabel}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

async function reverseGeocode(lat, lng, language = 'en') {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '1',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': language,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name ? String(data.display_name) : null;
  } catch {
    return null;
  }
}

function shortLabel(name, id) {
  const n = String(name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const second = parts.length > 1 ? (parts[1]?.[0] || '') : (parts[0]?.[1] || '');
    const label = `${first}${second}`.trim();
    if (label) return label;
  }
  const fallback = String(id || '').trim();
  return fallback ? fallback.slice(0, 2).toUpperCase() : 'D';
}

export default function TrackingPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useContext(ToastContext);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [driverAddresses, setDriverAddresses] = useState({});
  const wsRef = useRef(null);
  const wsHadConnectionRef = useRef(false);

  const q = searchParams.get('q') || '';
  const selectedDriverId = searchParams.get('driverId') || '';

  const setQuery = useCallback((next) => {
    const merged = {
      q,
      driverId: selectedDriverId,
      ...next,
    };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v == null) return;
      const s = String(v);
      if (!s) return;
      params.set(k, s);
    });
    setSearchParams(params, { replace: true });
  }, [q, selectedDriverId, setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const geocodeCacheRef = useRef(new Map());
  const geocodeInFlightRef = useRef(new Set());
  const geocodeRunIdRef = useRef(0);

  const reconnectTimerRef = useRef(null);
  const fallbackPollTimerRef = useRef(null);

  const loadInitialPositions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { trackingService: api } = await import('../../services/tracking.service');
      const res = await api.getActiveDrivers();
      const formatted = (res.data || []).map(d => ({
        id: d.id,
        name: d.name,
        lat: d.lastKnownLat ? parseFloat(d.lastKnownLat) : null,
        lng: d.lastKnownLng ? parseFloat(d.lastKnownLng) : null,
        lastUpdate: d.lastLocationAt
      }));
      setDrivers(formatted.filter(d => d.lat !== null));
    } catch (err) {
      console.error(err);
      const msg = err?.message || t('tracking.messages.load_failed');
      setLoadError(msg);
      addToast(msg, 'error');
    }
    finally { setLoading(false); }
  }, [addToast, t]);

  const connectWebSocket = useCallback(async () => {
    let token = http.getAccessToken();
    if (!token) {
      const refreshed = await http.tryRefresh();
      if (!refreshed) return;
      token = http.getAccessToken();
    }
    if (!token) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const ws = new WebSocket(buildTrackingWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      wsHadConnectionRef.current = true;
      setWsStatus('connected');
    };
    ws.onclose = () => {
      setWsStatus('disconnected');
      if (wsHadConnectionRef.current) {
        addToast(t('tracking.messages.reconnecting'), 'warning');
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
    };
    ws.onerror = () => {
      setWsStatus('error');
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const guard = evaluateRealtimeEvent('admin-tracking', data?.type, data);
        if (guard.gapDetected) {
          loadInitialPositions();
        }

        if (data.type === 'initial_positions') {
          const formatted = data.data.map(d => ({
            id: d.id,
            name: d.name,
            lat: d.lastKnownLat ? parseFloat(d.lastKnownLat) : null,
            lng: d.lastKnownLng ? parseFloat(d.lastKnownLng) : null,
            lastUpdate: d.lastLocationAt
          }));
          setDrivers(formatted.filter(d => d.lat !== null));
        } else if (data.type === 'driver_position') {
          const update = data.data;
          setDrivers(prev => {
            const existing = prev.findIndex(d => d.id === update.driverId);
            const driverData = {
              id: update.driverId,
              name: update.driverName,
              lat: parseFloat(update.latitude),
              lng: parseFloat(update.longitude),
              lastUpdate: update.timestamp
            };
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = driverData;
              return updated;
            }
            return [...prev, driverData];
          });
        }
      } catch (err) { console.error(err); }
    };
  }, [addToast, t, loadInitialPositions]);

  useEffect(() => {
    loadInitialPositions();
    connectWebSocket();

    const handleOnline = () => {
      resetRealtimeStream('admin-tracking');
      loadInitialPositions();
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadInitialPositions();
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    fallbackPollTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      loadInitialPositions();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (fallbackPollTimerRef.current) clearInterval(fallbackPollTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket, loadInitialPositions]);

  function formatTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  }

  const driverColorMap = useMemo(() => {
    const sorted = [...drivers].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const map = {};
    for (let i = 0; i < sorted.length; i += 1) {
      map[sorted[i].id] = DRIVER_MARKER_COLORS[i % DRIVER_MARKER_COLORS.length];
    }
    return map;
  }, [drivers]);

  const driverIconCacheRef = useRef(new Map());
  const getDriverIcon = useCallback((driver) => {
    const driverId = driver?.id;
    if (!driverId) return undefined;
    const color = driverColorMap[driverId] || DRIVER_MARKER_COLORS[0];
    const label = shortLabel(driver?.name, driverId);
    const cacheKey = `${driverId}:${color}:${label}`;
    const existing = driverIconCacheRef.current.get(cacheKey);
    if (existing) return existing;
    const icon = createDriverMarkerIcon({ color, label });
    driverIconCacheRef.current.set(cacheKey, icon);
    return icon;
  }, [driverColorMap]);

  const resolveDriverAddresses = useCallback(async (list, runId) => {
    const language = i18n.language || 'en';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const candidates = (list || [])
      .filter((d) => d?.lat != null && d?.lng != null)
      .map((d) => {
        const key = `${Number(d.lat).toFixed(4)},${Number(d.lng).toFixed(4)}`;
        return { driverId: d.id, lat: d.lat, lng: d.lng, key };
      });

    for (const c of candidates) {
      if (runId !== geocodeRunIdRef.current) return;
      if (geocodeCacheRef.current.has(c.key)) {
        const cached = geocodeCacheRef.current.get(c.key);
        const value = cached || `${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}`;
        setDriverAddresses((prev) => (prev[c.driverId] === value ? prev : { ...prev, [c.driverId]: value }));
        continue;
      }
      if (geocodeInFlightRef.current.has(c.key)) continue;

      geocodeInFlightRef.current.add(c.key);
      try {
        const addr = await reverseGeocode(c.lat, c.lng, language);
        geocodeCacheRef.current.set(c.key, addr);
        const value = addr || `${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}`;
        setDriverAddresses((prev) => ({ ...prev, [c.driverId]: value }));
      } finally {
        geocodeInFlightRef.current.delete(c.key);
      }

      // Nominatim usage: throttle requests
      await sleep(900);
    }
  }, [i18n.language]);

  useEffect(() => {
    // Resolve addresses in the background (throttled).
    geocodeRunIdRef.current += 1;
    const runId = geocodeRunIdRef.current;

    // Prioritize most recently updated drivers first.
    const prioritized = [...drivers]
      .sort((a, b) => {
        const ta = a?.lastUpdate ? new Date(a.lastUpdate).getTime() : 0;
        const tb = b?.lastUpdate ? new Date(b.lastUpdate).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 25);

    resolveDriverAddresses(prioritized, runId);
  }, [drivers, resolveDriverAddresses]);

  function isDriverLive(lastUpdate) {
    if (!lastUpdate) return false;
    const ageMs = Date.now() - new Date(lastUpdate).getTime();
    return ageMs <= 2 * 60 * 1000;
  }

  const envCenter = import.meta.env.VITE_DEFAULT_MAP_CENTER;
  const parsedCenter = envCenter
    ? envCenter.split(',').map((value) => Number.parseFloat(value.trim()))
    : null;
  const defaultCenter =
    parsedCenter && parsedCenter.length === 2 && parsedCenter.every((n) => Number.isFinite(n))
      ? parsedCenter
      : [0, 0];
  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) return null;
    return drivers.find((d) => String(d.id) === String(selectedDriverId)) || null;
  }, [drivers, selectedDriverId]);

  const activeCenter = selectedDriver?.lat != null && selectedDriver?.lng != null
    ? [selectedDriver.lat, selectedDriver.lng]
    : (drivers.length > 0 ? [drivers[0].lat, drivers[0].lng] : defaultCenter);

  const filteredDrivers = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter((d) =>
      String(d?.name || '').toLowerCase().includes(query) ||
      String(d?.id || '').toLowerCase().includes(query)
    );
  }, [drivers, q]);

  const mapDrivers = useMemo(() => {
    const query = String(q || '').trim();
    if (!query) return drivers;
    // When filtering, only render filtered drivers on the map
    // (keep selected driver visible if it exists but isn't in the filter result).
    if (!selectedDriver) return filteredDrivers;
    const hasSelected = filteredDrivers.some((d) => String(d.id) === String(selectedDriver.id));
    return hasSelected ? filteredDrivers : [...filteredDrivers, selectedDriver];
  }, [drivers, filteredDrivers, q, selectedDriver]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('tracking.title')}</h1>
          <p className="page-subtitle">{t('tracking.subtitle')}</p>
        </div>
        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="flex gap-xs" style={{ alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ minWidth: 240 }}
              placeholder={t('tracking.search_placeholder')}
              value={q}
              onChange={(e) => setQuery({ q: e.target.value })}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              {t('common.filters.clear')}
            </button>
          </div>
          <span className={`status-led ${wsStatus === 'connected' ? 'status-led-online' : 'status-led-offline'}`} />
          <Radio size={16} className={wsStatus === 'connected' ? '' : 'text-muted'} style={{ color: wsStatus === 'connected' ? 'var(--color-success)' : undefined }} />
          <span className={`badge ${wsStatus === 'connected' ? 'badge-success' : 'badge-danger'}`}>
            {wsStatus === 'connected' ? t('tracking.status.live') : t('tracking.status.disconnected')}
          </span>
        </div>
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('tracking.card.title')}</span>
              <span className="badge badge-info">{drivers.length}</span>
            </div>
            <span className={`badge ${wsStatus === 'connected' ? 'badge-success' : 'badge-danger'}`}>
              {wsStatus === 'connected' ? t('tracking.status.live') : t('tracking.status.disconnected')}
            </span>
          </div>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: '1fr 300px', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, height: '600px', overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={activeCenter} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter center={activeCenter} />
            {mapDrivers.map(d => (
              d.lat != null && d.lng != null && (
                <Marker key={d.id} position={[d.lat, d.lng]} icon={getDriverIcon(d)}>
                  <Popup>
                    <div style={{ color: 'var(--color-text)' }}>
                      <strong>{d.name || t('tracking.unknown_driver')}</strong><br />
                      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}>
                        {driverAddresses[d.id] || `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`}
                      </div>
                      {t('tracking.popup.last_seen', { time: formatTime(d.lastUpdate) })}
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>

        <div className="card" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ marginBottom: '1rem' }}>
            <h3 className="card-title">{t('tracking.card.title')}</h3>
            <span className="badge badge-info">{drivers.length}</span>
          </div>

          <div style={{ padding: '0 var(--space-md) var(--space-sm)' }}>
            <select
              className="form-select"
              value={selectedDriverId}
              onChange={(e) => setQuery({ driverId: e.target.value })}
            >
              <option value="">{t('tracking.focus.none')}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || String(d.id).slice(0, 8)}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted" style={{ marginTop: 6 }}>
              {t('tracking.showing', { shown: filteredDrivers.length, total: drivers.length })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <ListLoading label={t('common.loading')} />
            ) : loadError ? (
              <div style={{ padding: 'var(--space-md)' }}>
                <ListError message={loadError} onRetry={loadInitialPositions} onClearFilters={clearFilters} />
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div style={{ padding: 'var(--space-md)' }}>
                <ListEmpty title={t('tracking.card.empty')} subtitle={q ? t('tracking.empty_filtered') : undefined} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 var(--space-md) var(--space-md)' }}>
                {filteredDrivers.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    className="flex items-center gap-sm"
                    onClick={() => setQuery({ driverId: d.id })}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: String(d.id) === String(selectedDriverId) ? '1px solid var(--color-primary)' : '1px solid transparent',
                      background: String(d.id) === String(selectedDriverId) ? 'rgba(59, 130, 246, 0.08)' : 'var(--color-bg-tertiary)',
                      cursor: 'pointer',
                      color: 'inherit'
                    }}
                  >
                    <span className={`status-led ${isDriverLive(d.lastUpdate) ? 'status-led-online' : 'status-led-offline'}`} />
                    <MapPin size={16} style={{ color: driverColorMap[d.id] || 'var(--color-success)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.name || String(d.id).slice(0, 8)}
                      </div>
                      <div className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {driverAddresses[d.id] || (d.lat != null && d.lng != null ? `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}` : t('common.loading'))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
