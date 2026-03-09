import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Radio } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ToastContext } from '../../contexts/toastContext';
import { buildTrackingWsUrl } from '../../utils/trackingWs';
import { http } from '../../services/http.service';

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

export default function TrackingPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const wsHadConnectionRef = useRef(false);

  const reconnectTimerRef = useRef(null);

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
        addToast('Live tracking disconnected. Reconnecting...', 'warning');
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
  }, [addToast]);

  const loadInitialPositions = useCallback(async () => {
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
      addToast(err.message || 'Failed to load active drivers.', 'error');
    }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => {
    loadInitialPositions();
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket, loadInitialPositions]);

  function formatTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  }

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
  const activeCenter = drivers.length > 0 ? [drivers[0].lat, drivers[0].lng] : defaultCenter;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('tracking.title')}</h1>
          <p className="page-subtitle">{t('tracking.subtitle')}</p>
        </div>
        <div className="flex items-center gap-sm">
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
            {drivers.map(d => (
              d.lat != null && d.lng != null && (
                <Marker key={d.id} position={[d.lat, d.lng]}>
                  <Popup>
                    <div style={{ color: 'var(--color-bg)' }}>
                      <strong>{d.name || t('verification.card.unknown')}</strong><br />
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

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div className="loading-page" style={{ minHeight: '200px' }}><div className="spinner"></div></div>
            ) : drivers.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="text-muted">{t('tracking.card.empty')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {drivers.map(d => (
                  <div key={d.id} className="flex items-center gap-sm" style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-tertiary)' }}>
                    <span className={`status-led ${isDriverLive(d.lastUpdate) ? 'status-led-online' : 'status-led-offline'}`} />
                    <MapPin size={16} style={{ color: 'var(--color-success)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.name || d.id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-muted">
                        {d.lat?.toFixed(5)}, {d.lng?.toFixed(5)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
