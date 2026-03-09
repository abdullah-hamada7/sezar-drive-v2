import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { tripService as api } from '../../services/trip.service';
import { Route, Play, CheckCircle, MapPin, Clock, Phone, User, AlertTriangle } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import { useShift } from '../../contexts/ShiftContext';
import PromptModal from '../../components/common/PromptModal';

const STATUS_BADGES = { ASSIGNED: 'badge-info', IN_PROGRESS: 'badge-warning', COMPLETED: 'badge-success', CANCELLED: 'badge-danger' };

export default function DriverTrips() {
  const { t } = useTranslation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectPrompt, setRejectPrompt] = useState({ isOpen: false, tripId: null });
  const { addToast } = useContext(ToastContext);
  const { activeShift } = useShift();

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleUpdate = () => {
      load();
    };

    window.addEventListener('ws:trip_assigned', handleUpdate);
    window.addEventListener('ws:trip_cancelled', handleUpdate);
    window.addEventListener('ws:trip_completed', handleUpdate);

    return () => {
      window.removeEventListener('ws:trip_assigned', handleUpdate);
      window.removeEventListener('ws:trip_cancelled', handleUpdate);
      window.removeEventListener('ws:trip_completed', handleUpdate);
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getTrips('limit=20');
      setTrips(res.data.trips || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleStart(id) {
    setActionLoading(id);
    try {
      await api.startTrip(id);
      load();
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAccept(id) {
    setActionLoading(id);
    try {
      await api.acceptTrip(id);
      load();
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete(id) {
    setActionLoading(id);
    try {
      await api.completeTrip(id);
      load();
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function onConfirmReject(reason) {
    try {
      await api.rejectTrip(rejectPrompt.tripId, { reason });
      addToast(t('trip.reject_success'), 'success');
      load();
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>{t('trip.my_trips')}</h2>

      {!activeShift && (
        <div className="alert alert-warning mb-md">
          <AlertTriangle size={20} />
          <div>{t('trip.no_active_shift_warning') || 'You must start a shift to begin trips.'}</div>
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
                <span className={`badge ${STATUS_BADGES[trip.status]}`}>{t(`common.trip_status.${trip.status.toLowerCase()}`, trip.status)}</span>
                <span className="text-sm text-muted">{trip.price} {t('trip.price_unit')}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: 'var(--space-md)' }}>
                <div className="flex items-center gap-sm">
                  <MapPin size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <span className="text-sm">{trip.pickupLocation}</span>
                </div>
                <div className="flex items-center gap-sm">
                  <MapPin size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                  <span className="text-sm">{trip.dropoffLocation}</span>
                </div>
                {trip.scheduledTime && (
                  <div className="flex items-center gap-sm">
                    <Clock size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span className="text-sm text-muted">{new Date(trip.scheduledTime).toLocaleString()}</span>
                  </div>
                )}

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
                      </div>
                      <div className="flex items-center gap-sm text-muted">
                        <span className="text-sm font-medium">
                          {t('trips.modal.companion_count_ph')}: {trip.passengers[0].companionCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {trip.status === 'ASSIGNED' && (
                <div className="flex gap-sm" style={{ width: '100%' }}>
                  {trip.scheduledTime && new Date(trip.scheduledTime) > new Date() ? (
                    <button className="btn btn-primary" onClick={() => handleAccept(trip.id)} disabled={actionLoading === trip.id} style={{ flex: 1 }}>
                      <CheckCircle size={16} /> {t('trip.accept_trip')}
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => handleStart(trip.id)} disabled={actionLoading === trip.id} style={{ flex: 1 }}>
                      <Play size={16} className="mirror-rtl" /> {t('trip.start_trip')}
                    </button>
                  )}
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
                <button className="btn btn-primary" onClick={() => handleStart(trip.id)} disabled={actionLoading === trip.id} style={{ width: '100%' }}>
                  <Play size={16} className="mirror-rtl" /> {t('trip.start_trip')}
                </button>
              )}
              {trip.status === 'IN_PROGRESS' && (
                <button className="btn btn-success" onClick={() => handleComplete(trip.id)} disabled={actionLoading === trip.id} style={{ width: '100%' }}>
                  <CheckCircle size={16} /> {t('trip.complete_trip')}
                </button>
              )}
            </div>
          ))}
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
    </div>
  );
}
