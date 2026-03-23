import { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { tripService as api } from '../../services/trip.service';
import { Route, Play, CheckCircle, MapPin, Clock, Phone, User, AlertTriangle, X } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import { useShift } from '../../contexts/ShiftContext';
import { useAuth } from '../../hooks/useAuth';
import PromptModal from '../../components/common/PromptModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import WhatsAppLink from '../../components/common/WhatsAppLink';
import { MapContainer, Marker, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createDotMarkerIcon(color) {
  return L.divIcon({
    className: 'trip-dot-marker',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: ${color};
        border: 2px solid rgba(255, 255, 255, 0.95);
        box-shadow: 0 3px 10px rgba(0,0,0,0.45);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

const MARKER_ICONS = {
  current: createDotMarkerIcon('#3b82f6'),
  pickup: createDotMarkerIcon('#22c55e'),
  dropoff: createDotMarkerIcon('#ef4444'),
};

const STATUS_BADGES = { ASSIGNED: 'badge-info', IN_PROGRESS: 'badge-warning', COMPLETED: 'badge-success', CANCELLED: 'badge-danger' };

function looksLikeCoordinateLabel(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(trimmed);
}

function toCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
        'Accept': 'application/json',
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

function MapAutoFollow({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    try {
      map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
    } catch {
      // ignore map errors
    }
  }, [map, position]);

  return null;
}

function TripDetailsMap({ trip, currentLat, currentLng, currentLabel, pickupLabel, dropoffLabel, labels, height = 520 }) {
  const pickupLat = toCoord(trip?.pickupLat);
  const pickupLng = toCoord(trip?.pickupLng);
  const dropoffLat = toCoord(trip?.dropoffLat);
  const dropoffLng = toCoord(trip?.dropoffLng);
  const curLat = toCoord(currentLat);
  const curLng = toCoord(currentLng);

  const pickup = pickupLat != null && pickupLng != null ? [pickupLat, pickupLng] : null;
  const dropoff = dropoffLat != null && dropoffLng != null ? [dropoffLat, dropoffLng] : null;
  const current = curLat != null && curLng != null ? [curLat, curLng] : null;

  if (!pickup && !dropoff && !current) return null;

  const center = pickup || current || dropoff || [30.0444, 31.2357];
  const polyline = [current, pickup, dropoff].filter(Boolean);

  return (
    <div style={{ height, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {current && <MapAutoFollow position={current} />}
        {polyline.length >= 2 && (
          <Polyline positions={polyline} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.9 }} />
        )}
        {current && (
          <Marker position={current} icon={MARKER_ICONS.current}>
            <Popup>
              <div style={{ fontWeight: 650, marginBottom: 4 }}>{labels?.current || 'Current location'}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{currentLabel || '—'}</div>
            </Popup>
          </Marker>
        )}
        {pickup && (
          <Marker position={pickup} icon={MARKER_ICONS.pickup}>
            <Popup>
              <div style={{ fontWeight: 650, marginBottom: 4 }}>{labels?.pickup || 'Pickup'}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{pickupLabel || trip?.pickupLocation || '—'}</div>
            </Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker position={dropoff} icon={MARKER_ICONS.dropoff}>
            <Popup>
              <div style={{ fontWeight: 650, marginBottom: 4 }}>{labels?.dropoff || 'Dropoff'}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{dropoffLabel || trip?.dropoffLocation || '—'}</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

export default function DriverTrips() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectPrompt, setRejectPrompt] = useState({ isOpen: false, tripId: null });
  const [cashCollectPrompt, setCashCollectPrompt] = useState({ isOpen: false, tripId: null });
  const [confirmAction, setConfirmAction] = useState({ isOpen: false, type: null, tripId: null });
  const [mapDetails, setMapDetails] = useState({ isOpen: false, trip: null });
  const [livePosition, setLivePosition] = useState(null);
  const [liveAddress, setLiveAddress] = useState('');
  const [addressOverrides, setAddressOverrides] = useState({});
  const { addToast } = useContext(ToastContext);
  const { activeShift } = useShift();
  const { user } = useAuth();
  const isShiftActive = String(activeShift?.status || '').toLowerCase() === 'active';
  const lastReverseRef = useRef({ at: 0, lat: null, lng: null });
  const addressOverridesRef = useRef({});

  function getScheduledStartGate(scheduledTime) {
    if (!scheduledTime) return { canStart: true, scheduledAt: null, availableAt: null, minutesUntil: 0 };
    const scheduledAt = new Date(scheduledTime);
    if (Number.isNaN(scheduledAt.getTime())) return { canStart: true, scheduledAt: null, availableAt: null, minutesUntil: 0 };
    const availableAt = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
    const now = new Date();
    if (now < availableAt) {
      const minutesUntil = Math.max(1, Math.ceil((availableAt.getTime() - now.getTime()) / 60000));
      return { canStart: false, scheduledAt, availableAt, minutesUntil };
    }
    return { canStart: true, scheduledAt, availableAt, minutesUntil: 0 };
  }

  function shouldRefreshTripsOnError(code) {
    return ['NOT_FOUND', 'INVALID_TRIP', 'INVALID_STATE_TRANSITION', 'CONCURRENT_MODIFICATION', 'CONFLICT'].includes(String(code || ''));
  }

  useEffect(() => {
    addressOverridesRef.current = addressOverrides;
  }, [addressOverrides]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleUpdate = () => {
      load({ silent: true });
    };

    window.addEventListener('ws:trip_assigned', handleUpdate);
    window.addEventListener('ws:trip_cancelled', handleUpdate);
    window.addEventListener('ws:trip_completed', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    window.addEventListener('online', handleUpdate);
    const poll = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      handleUpdate();
    }, 15000);

    return () => {
      window.removeEventListener('ws:trip_assigned', handleUpdate);
      window.removeEventListener('ws:trip_cancelled', handleUpdate);
      window.removeEventListener('ws:trip_completed', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
      window.removeEventListener('online', handleUpdate);
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const hasInProgress = trips.some((trip) => trip.status === 'IN_PROGRESS');
    if (!hasInProgress) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLivePosition([lat, lng]);

        const now = Date.now();
        const last = lastReverseRef.current;
        const movedEnough = last.lat == null || last.lng == null
          ? true
          : (Math.abs(lat - last.lat) + Math.abs(lng - last.lng)) > 0.0006; // ~70m-ish
        const timeEnough = now - last.at > 30000;

        if (movedEnough && timeEnough) {
          lastReverseRef.current = { at: now, lat, lng };
          const addr = await reverseGeocode(lat, lng, i18n.language || 'en');
          if (addr) setLiveAddress(addr);
        }
      },
      () => {
        // ignore GPS errors; fallback to lastKnown
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        // ignore
      }
    };
  }, [trips, i18n.language]);

  useEffect(() => {
    if (!trips.length) return;
    let cancelled = false;

    (async () => {
      for (const trip of trips) {
        if (!trip?.id) continue;

        const pickupLat = toCoord(trip.pickupLat);
        const pickupLng = toCoord(trip.pickupLng);
        const dropoffLat = toCoord(trip.dropoffLat);
        const dropoffLng = toCoord(trip.dropoffLng);

        if (pickupLat != null && pickupLng != null) {
          const key = `${trip.id}:pickup`;
          const already = addressOverridesRef.current[key];
          if (!already && looksLikeCoordinateLabel(trip.pickupLocation || '')) {
            const addr = await reverseGeocode(pickupLat, pickupLng, i18n.language || 'en');
            if (!cancelled && addr) {
              setAddressOverrides((prev) => ({ ...prev, [key]: addr }));
            }
          }
        }

        if (dropoffLat != null && dropoffLng != null) {
          const key = `${trip.id}:dropoff`;
          const already = addressOverridesRef.current[key];
          if (!already && looksLikeCoordinateLabel(trip.dropoffLocation || '')) {
            const addr = await reverseGeocode(dropoffLat, dropoffLng, i18n.language || 'en');
            if (!cancelled && addr) {
              setAddressOverrides((prev) => ({ ...prev, [key]: addr }));
            }
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trips, i18n.language]);

  useEffect(() => {
    if (liveAddress) return;
    const lat = toCoord(user?.lastKnownLat);
    const lng = toCoord(user?.lastKnownLng);
    if (lat == null || lng == null) return;

    if (!livePosition) {
      setLivePosition([lat, lng]);
    }

    let cancelled = false;
    (async () => {
      const addr = await reverseGeocode(lat, lng, i18n.language || 'en');
      if (!cancelled && addr) setLiveAddress(addr);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.lastKnownLat, user?.lastKnownLng, i18n.language, liveAddress, livePosition]);

  function notifyTripUiUpdate() {
    try {
      window.dispatchEvent(new Event('ws:update'));
    } catch {
      // ignore
    }
  }

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const res = await api.getTrips('limit=20');
      setTrips(res.data.trips || []);
    } catch (err) { console.error(err); }
    finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleStart(id) {
    if (!isShiftActive) {
      addToast(t('trip.no_active_shift_warning'), 'error');
      setConfirmAction({ isOpen: false, type: null, tripId: null });
      navigate('/driver/shift');
      return;
    }
    setActionLoading(id);
    try {
      await api.startTrip(id);
      notifyTripUiUpdate();
    } catch (err) {
      const code = err.errorCode || err.code;
      if (code === 'NO_ACTIVE_SHIFT' || code === 'INVALID_SHIFT' || code === 'TRIP_SHIFT_MISMATCH') {
        addToast(t('trip.no_active_shift_warning'), 'error');
        setConfirmAction({ isOpen: false, type: null, tripId: null });
        navigate('/driver/shift');
        return;
      }

      if (shouldRefreshTripsOnError(code)) {
        setConfirmAction({ isOpen: false, type: null, tripId: null });
      }
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      await load({ silent: true });
      setActionLoading(null);
    }
  }

  async function handleAccept(id) {
    setActionLoading(id);
    try {
      await api.acceptTrip(id);
      notifyTripUiUpdate();
    } catch (err) {
      const code = err.errorCode || err.code;
      if (shouldRefreshTripsOnError(code)) {
        setConfirmAction({ isOpen: false, type: null, tripId: null });
      }
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      await load({ silent: true });
      setActionLoading(null);
    }
  }

  async function handleComplete(id) {
    setActionLoading(id);
    try {
      await api.completeTrip(id);
      notifyTripUiUpdate();
    } catch (err) {
      const code = err.errorCode || err.code;
      if (shouldRefreshTripsOnError(code)) {
        setConfirmAction({ isOpen: false, type: null, tripId: null });
      }
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      await load({ silent: true });
      setActionLoading(null);
    }
  }

  async function handleMarkCashCollected(id, note) {
    setActionLoading(id);
    try {
      await api.markCashCollected(id, note);
      addToast(t('trip.payment.cash_collected_success'), 'success');
      notifyTripUiUpdate();
    } catch (err) {
      const code = err.errorCode || err.code;
      if (shouldRefreshTripsOnError(code)) {
        // fall through; always reload in finally
      }
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      await load({ silent: true });
      setActionLoading(null);
    }
  }

  async function onConfirmCashCollected(note) {
    const tripId = cashCollectPrompt.tripId;
    if (!tripId) return;
    await handleMarkCashCollected(tripId, note);
  }

  async function onConfirmReject(reason) {
    try {
      await api.rejectTrip(rejectPrompt.tripId, { reason });
      addToast(t('trip.reject_success'), 'success');
      setRejectPrompt({ isOpen: false, tripId: null });
      notifyTripUiUpdate();
    } catch (err) {
      const code = err.errorCode || err.code;
      if (shouldRefreshTripsOnError(code)) {
        setRejectPrompt({ isOpen: false, tripId: null });
      }
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      await load({ silent: true });
    }
  }

  function getConfirmCopy(actionType) {
    switch (actionType) {
      case 'accept':
        return { title: t('trip.accept_trip'), message: t('trip.accept_trip_confirm'), confirmText: t('trip.accept_trip'), variant: 'primary' };
      case 'start':
        return { title: t('trip.start_trip'), message: t('trip.start_trip_confirm'), confirmText: t('trip.start_trip'), variant: 'primary' };
      case 'complete':
        return { title: t('trip.complete_trip'), message: t('trip.complete_trip_confirm'), confirmText: t('trip.complete_trip'), variant: 'success' };
      default:
        return { title: t('common.confirm'), message: '', confirmText: t('common.confirm'), variant: 'primary' };
    }
  }

  async function onConfirmAction() {
    const { type, tripId } = confirmAction;
    if (!type || !tripId) return;
    if (type === 'accept') return handleAccept(tripId);
    if (type === 'start') return handleStart(tripId);
    if (type === 'complete') return handleComplete(tripId);
  }

  const confirmCopy = getConfirmCopy(confirmAction.type);

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  const paymentLabel = (method) => {
    const m = String(method || 'CASH').toUpperCase();
    if (m === 'CASH') return t('trip.payment.cash');
    if (m === 'E_WALLET') return t('trip.payment.ewallet');
    if (m === 'E_PAYMENT') return t('trip.payment.epayment');
    return m;
  };

  const formatWhen = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(i18n.language);
  };

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>{t('trip.my_trips')}</h2>

      {!isShiftActive && (
        <div className="card mb-md" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div className="flex items-center gap-md" style={{ justifyContent: 'space-between' }}>
            <div className="flex items-center gap-md">
              <AlertTriangle size={22} style={{ color: 'var(--color-warning)' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{t('trip.shift_required_title')}</div>
                <div className="text-sm text-muted">{t('trip.no_active_shift_warning')}</div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/driver/shift')}>
              {t('trip.go_to_shift')}
            </button>
          </div>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="card empty-state">
          <Route size={40} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
          <p>{t('trip.no_trips')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {trips.map(trip => (
            <div key={trip.id} className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                <span className={`badge badge-status ${STATUS_BADGES[trip.status]}`}>{t(`common.trip_status.${trip.status.toLowerCase()}`, trip.status)}</span>
                {(() => {
                  const method = String(trip.paymentMethod || 'CASH').toUpperCase();
                  const isCash = method === 'CASH';
                  const total = Number(trip.price);
                  const totalText = Number.isFinite(total) ? total.toFixed(2) : String(trip.price);
                  return (
                    <span className="text-sm text-muted">
                      {isCash ? (
                        <span className={trip.cashCollectedAt ? 'badge badge-success' : 'badge badge-danger'} style={{ fontWeight: 750 }}>
                          {trip.cashCollectedAt
                            ? t('trip.payment.cash_collected')
                            : `${t('trip.payment.collect')}: ${totalText} ${t('trip.price_unit')}`}
                        </span>
                      ) : (
                        <>
                          {t('trip.payment.method')}: {paymentLabel(method)}
                        </>
                      )}
                    </span>
                  );
                })()}
              </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: 'var(--space-md)' }}>
                  <div className="flex items-center gap-sm">
                    <MapPin size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span className="text-sm">
                      {t('trip.pickup')}:{' '}
                      {addressOverrides[`${trip.id}:pickup`] || trip.pickupLocation}
                    </span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <MapPin size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                    <span className="text-sm">
                      {t('trip.dropoff')}:{' '}
                      {addressOverrides[`${trip.id}:dropoff`] || trip.dropoffLocation}
                    </span>
                    </div>
                {trip.scheduledTime && (
                  <div className="flex items-center gap-sm">
                    <Clock size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span className="text-sm text-muted">{t('trip.starts_at')}: {formatWhen(trip.scheduledTime) || '—'}</span>
                  </div>
                )}

                {(() => {
                  const method = String(trip.paymentMethod || 'CASH').toUpperCase();
                  const isCash = method === 'CASH';
                  const total = Number(trip.price);
                  const totalText = Number.isFinite(total) ? total.toFixed(2) : String(trip.price);
                  return (
                    <>
                      <div className="flex items-center gap-sm">
                        <CheckCircle size={14} style={{ color: isCash ? 'var(--color-danger)' : 'var(--color-success)', flexShrink: 0 }} />
                        <span className="text-sm">{t('trip.payment.method')}: {paymentLabel(method)}</span>
                        {isCash ? (
                          <span className={trip.cashCollectedAt ? 'badge badge-success' : 'badge badge-danger'} style={{ marginInlineStart: 'auto', fontWeight: 750 }}>
                            {trip.cashCollectedAt
                              ? t('trip.payment.cash_collected')
                              : `${t('trip.payment.collect')}: ${totalText} ${t('trip.price_unit')}`}
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ marginInlineStart: 'auto' }}>{t('trip.payment.paid')}</span>
                        )}
                      </div>

                      {isCash && trip.cashCollectedAt && (
                        <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                          {t('trip.payment.cash_collected_at')}: {formatWhen(trip.cashCollectedAt) || '—'}
                          {trip.cashCollectedNote ? ` | ${t('trip.payment.cash_collected_note')}: ${trip.cashCollectedNote}` : ''}
                        </div>
                      )}
                    </>
                  );
                })()}

                {trip.passengers && trip.passengers.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                    <div className="text-xs font-bold text-muted uppercase mb-xs">{t('trip.passenger')}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <User size={14} />
                        <span className="text-sm">{trip.passengers[0].name || t('trip.passenger')}</span>
                      </div>
                      <div className="flex items-center gap-sm text-primary">
                        <Phone size={14} />
                        <a href={`tel:${trip.passengers[0].phone}`} className="text-sm font-medium" style={{ textDecoration: 'none', color: 'inherit' }}>
                          {trip.passengers[0].phone || t('trip.no_phone')}
                        </a>
                        <WhatsAppLink
                          phone={trip.passengers[0].phone}
                          title={t('trip.contact_whatsapp')}
                          size={18}
                          className="text-success"
                        />
                      </div>
                      <div className="flex items-center gap-sm text-muted">
                        <span className="text-sm font-medium">
                          {t('trips.modal.companion_count_ph')}: {trip.passengers[0].companionCount ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-sm text-muted">
                        <span className="text-sm font-medium">
                          {t('trips.modal.bags_ph')}: {trip.passengers[0].bagCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-sm)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => setMapDetails({ isOpen: true, trip })}
                  style={{ width: '100%' }}
                >
                  {t('trip.map_details')}
                </button>
              </div>

              {trip.status === 'ASSIGNED' && (
                <div className="flex gap-sm" style={{ width: '100%' }}>
                  {(() => {
                    const gate = getScheduledStartGate(trip.scheduledTime);
                    if (trip.scheduledTime && !gate.canStart) {
                      return (
                        <button
                          className="btn btn-primary"
                          onClick={() => setConfirmAction({ isOpen: true, type: 'accept', tripId: trip.id })}
                          disabled={actionLoading === trip.id || !isShiftActive}
                          style={{ flex: 1 }}
                        >
                          <CheckCircle size={16} /> {t('trip.accept_trip')}
                        </button>
                      );
                    }
                    return (
                      <button
                        className="btn btn-primary"
                        onClick={() => setConfirmAction({ isOpen: true, type: 'start', tripId: trip.id })}
                        disabled={actionLoading === trip.id || !isShiftActive || !gate.canStart}
                        style={{ flex: 1 }}
                        title={!gate.canStart ? t('trip.start_available_in', { minutes: gate.minutesUntil }) : undefined}
                      >
                        <Play size={16} className="mirror-rtl" /> {t('trip.start_trip')}
                      </button>
                    );
                  })()}
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRejectPrompt({ isOpen: true, tripId: trip.id })}
                    disabled={actionLoading === trip.id}
                    style={{ flex: 1 }}
                  >
                    {t('trip.reject_trip')}
                  </button>
                </div>
              )}
              {trip.status === 'ACCEPTED' && (
                <div className="flex gap-sm" style={{ width: '100%' }}>
                  {(() => {
                    const gate = getScheduledStartGate(trip.scheduledTime);
                    return (
                      <button
                        className="btn btn-primary"
                        onClick={() => setConfirmAction({ isOpen: true, type: 'start', tripId: trip.id })}
                        disabled={actionLoading === trip.id || !isShiftActive || !gate.canStart}
                        style={{ flex: 1 }}
                        title={!gate.canStart ? t('trip.start_available_in', { minutes: gate.minutesUntil }) : undefined}
                      >
                        <Play size={16} className="mirror-rtl" /> {t('trip.start_trip')}
                      </button>
                    );
                  })()}
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRejectPrompt({ isOpen: true, tripId: trip.id })}
                    disabled={actionLoading === trip.id}
                    style={{ flex: 1 }}
                  >
                    {t('trip.reject_trip')}
                  </button>
                </div>
              )}
              {trip.status === 'IN_PROGRESS' && (
                <button className="btn btn-success" onClick={() => setConfirmAction({ isOpen: true, type: 'complete', tripId: trip.id })} disabled={actionLoading === trip.id} style={{ width: '100%' }}>
                  <CheckCircle size={16} /> {t('trip.complete_trip')}
                </button>
              )}

              {String(trip.paymentMethod || '').toUpperCase() === 'CASH' && trip.status === 'COMPLETED' && !trip.cashCollectedAt && (
                <button
                  className="btn btn-danger"
                  onClick={() => setCashCollectPrompt({ isOpen: true, tripId: trip.id })}
                  disabled={actionLoading === trip.id}
                  style={{ width: '100%', marginTop: 'var(--space-sm)' }}
                >
                  {t('trip.payment.mark_cash_collected')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ isOpen: false, type: null, tripId: null })}
        onConfirm={onConfirmAction}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmText={confirmCopy.confirmText}
        variant={confirmCopy.variant}
        size="sm"
      />

      {mapDetails.isOpen && mapDetails.trip && (
        <div className="modal-overlay" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
          <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('trip.map_details')}</h2>
              <button className="btn-icon" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <TripDetailsMap
                trip={mapDetails.trip}
                currentLat={livePosition?.[0] ?? user?.lastKnownLat}
                currentLng={livePosition?.[1] ?? user?.lastKnownLng}
                currentLabel={liveAddress}
                pickupLabel={addressOverrides[`${mapDetails.trip.id}:pickup`]}
                dropoffLabel={addressOverrides[`${mapDetails.trip.id}:dropoff`]}
                labels={{
                  current: t('trip.current_location'),
                  pickup: t('trip.pickup'),
                  dropoff: t('trip.dropoff'),
                }}
                height={520}
              />

              <div className="grid grid-3 gap-md" style={{ marginTop: 'var(--space-md)' }}>
                <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trip.current_location')}</div>
                  <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{liveAddress || t('trip.location_not_available')}</div>
                </div>
                <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trip.pickup')}</div>
                  <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{addressOverrides[`${mapDetails.trip.id}:pickup`] || mapDetails.trip.pickupLocation}</div>
                </div>
                <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trip.dropoff')}</div>
                  <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{addressOverrides[`${mapDetails.trip.id}:dropoff`] || mapDetails.trip.dropoffLocation}</div>
                </div>
                <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trip.payment.method')}</div>
                  <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{paymentLabel(mapDetails.trip.paymentMethod)}</div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <PromptModal
        isOpen={rejectPrompt.isOpen}
        onClose={() => setRejectPrompt({ isOpen: false, tripId: null })}
        onConfirm={onConfirmReject}
        title={t('trip.reject_trip')}
        message={t('trip.reject_prompt')}
        placeholder={t('trip.reject_reason_placeholder')}
        confirmText={t('common.reject')}
      />

      <PromptModal
        isOpen={cashCollectPrompt.isOpen}
        onClose={() => setCashCollectPrompt({ isOpen: false, tripId: null })}
        onConfirm={onConfirmCashCollected}
        title={t('trip.payment.cash_collect_note_title')}
        message={t('trip.payment.cash_collect_note_message')}
        placeholder={t('trip.payment.cash_collect_note_placeholder')}
        confirmText={t('trip.payment.mark_cash_collected')}
        maxLength={250}
        required={false}
      />
    </div>
  );
}
