import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { tripService as api } from '../../services/trip.service';
import { driverService } from '../../services/driver.service';
import { ToastContext } from '../../contexts/toastContext';
import { Eye, XCircle, MapPin, DollarSign, Save, X } from 'lucide-react';
import PromptModal from '../../components/common/PromptModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { EGYPT_PHONE_REGEX } from '../../utils/validation';
import { MapContainer, Marker, TileLayer, Polyline, Popup, useMapEvents } from 'react-leaflet';
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

const TRIP_MARKER_ICONS = {
  pickup: createDotMarkerIcon('#22c55e'),
  dropoff: createDotMarkerIcon('#ef4444'),
};

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

function TripMapClickHandler({ selectionMode, onSelect }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      onSelect(selectionMode, lat, lng);
    },
  });
  return null;
}

const STATUS_BADGES = {
  ASSIGNED: 'badge-info',
  IN_PROGRESS: 'badge-warning',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
  DEFAULT: 'badge-neutral',
};

export default function TripsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [trips, setTrips] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    driverId: '',
    pickupLocation: '',
    dropoffLocation: '',
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    price: '',
    scheduledTime: '',
    passengers: [{ name: '', phone: '', companionCount: 0, bagCount: 0 }]
  });
  const [mapSelectionMode, setMapSelectionMode] = useState('pickup');
  const [assignmentCharge, setAssignmentCharge] = useState(0);
  const [chargeDraft, setChargeDraft] = useState('0');
  const [savingCharge, setSavingCharge] = useState(false);
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [promptData, setPromptData] = useState({ isOpen: false, tripId: null });
  const [mapDetails, setMapDetails] = useState({ isOpen: false, trip: null });
  const [confirmSaveChargeOpen, setConfirmSaveChargeOpen] = useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);
  const filterLabel = statusFilter ? t(`common.status.${statusFilter.toLowerCase()}`) : t('trips.filter_all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 15 });
        if (statusFilter) params.set('status', statusFilter);
        const res = await api.getTrips(params.toString());
        setTrips(res.data.trips || []);
        setPagination(res.data || {});
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [page, statusFilter, refresh]);

  useEffect(() => {
    async function loadCharge() {
      try {
        const response = await api.getAssignmentCharge();
        const charge = Number(response.data?.charge ?? 0);
        const normalized = Number.isFinite(charge) ? charge : 0;
        setAssignmentCharge(normalized);
        setChargeDraft(String(normalized));
      } catch (err) {
        const msg = err.code ? t(`errors.${err.code}`) : (err.message || t('common.error'));
        addToast(msg, 'error');
      }
    }

    loadCharge();
  }, [addToast, t]);

  useEffect(() => {
    const handleUpdate = () => setRefresh(r => r + 1);
    window.addEventListener('ws:trip_assigned', handleUpdate);
    window.addEventListener('ws:trip_started', handleUpdate);
    window.addEventListener('ws:trip_completed', handleUpdate);
    window.addEventListener('ws:trip_cancelled', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    return () => {
      window.removeEventListener('ws:trip_assigned', handleUpdate);
      window.removeEventListener('ws:trip_started', handleUpdate);
      window.removeEventListener('ws:trip_completed', handleUpdate);
      window.removeEventListener('ws:trip_cancelled', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
    };
  }, []);

  async function openCreate() {
    setError('');
    setShowCreateModal(true);
    try {
      const res = await driverService.getDrivers('limit=100');
      setDrivers(res.data.drivers || []);
    } catch (err) {
      const msg = err.code ? t(`errors.${err.code}`) : (err.message || t('common.error'));
      addToast(msg, 'error');
    }
  }

  function toLocalInputValue(date) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function toOffsetISOString(date) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetAbs = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(offsetAbs / 60));
    const offsetMins = pad(offsetAbs % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!form.driverId) {
      addToast(t('trips.modal.select_driver'), 'error');
      return;
    }
    if (!String(form.pickupLocation || '').trim() || !String(form.dropoffLocation || '').trim()) {
      addToast(t('common.errors.check_fields'), 'error');
      return;
    }

    if (form.pickupLat == null || form.pickupLng == null || form.dropoffLat == null || form.dropoffLng == null) {
      addToast('Please pin pickup and dropoff on the map', 'error');
      return;
    }
    const parsedPrice = parseFloat(form.price);
    if (Number.isNaN(parsedPrice)) {
      addToast(t('trips.modal.price_label', { unit: t('common.currency') }), 'error');
      return;
    }
    const passenger = form.passengers?.[0];
    if (!passenger?.name?.trim() || !passenger?.phone?.trim()) {
      addToast(t('common.errors.check_fields'), 'error');
      return;
    }
    if (!EGYPT_PHONE_REGEX.test(passenger.phone.trim())) {
      addToast(t('drivers.modal.phone_invalid'), 'error');
      return;
    }

    setConfirmAssignOpen(true);
  }

  async function submitAssignTrip() {
    try {
      const parsedPrice = parseFloat(form.price);
      if (Number.isNaN(parsedPrice)) {
        addToast(t('trips.modal.price_label', { unit: t('common.currency') }), 'error');
        return;
      }

      let scheduledTime = form.scheduledTime;
      if (scheduledTime) {
        const scheduledDate = new Date(scheduledTime);
        if (!Number.isNaN(scheduledDate.getTime())) {
          scheduledTime = toOffsetISOString(scheduledDate);
        }
      }
      await api.assignTrip({ ...form, price: parsedPrice, scheduledTime });
      setShowCreateModal(false);
      setForm({
        driverId: '',
        pickupLocation: '',
        dropoffLocation: '',
        pickupLat: null,
        pickupLng: null,
        dropoffLat: null,
        dropoffLng: null,
        price: '',
        scheduledTime: '',
        passengers: [{ name: '', phone: '', companionCount: 0, bagCount: 0 }]
      });
      setSelectedDriverName('');
      setRefresh(r => r + 1);
    } catch (err) {
      const driverName = selectedDriverName || drivers.find(d => String(d.id) === String(form.driverId))?.name || '';
      addToast(err.code ? t(`errors.${err.code}`, { name: driverName }) : err.message, 'error');
    }
  }

  async function saveAssignmentCharge() {
    setSavingCharge(true);
    try {
      const parsed = Number(chargeDraft);
      await api.updateAssignmentCharge({ charge: Number.isFinite(parsed) ? parsed : 0 });
      const response = await api.getAssignmentCharge();
      const charge = Number(response.data?.charge ?? 0);
      const normalized = Number.isFinite(charge) ? charge : 0;
      setAssignmentCharge(normalized);
      setChargeDraft(String(normalized));
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setSavingCharge(false);
    }
  }

  async function handleCancel(id) {
    setPromptData({ isOpen: true, tripId: id });
  }

  async function onConfirmCancel(reason) {
    try {
      await api.cancelTrip(promptData.tripId, { reason });
      setRefresh(r => r + 1);
    } catch (err) { addToast(err.message, 'error'); }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('trips.title')}</h1>
          <p className="page-subtitle">{t('trips.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          {t('trips.assign_btn')}
        </button>
      </div>

      <div className="card p-sm mb-md flex gap-sm" style={{ overflowX: 'auto' }}>
        {['', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s ? t(`common.trip_status.${s.toLowerCase()}`) : t('trips.filter_all')}
          </button>
        ))}
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.table.status')}</span>
              <span className="badge badge-neutral">{filterLabel}</span>
            </div>
            <span className="badge badge-info">{trips.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-page"><div className="spinner"></div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('trips.table.driver')}</th>
                <th>{t('trips.table.pickup')}</th>
                <th>{t('trips.table.dropoff')}</th>
                <th>{t('trips.table.passengers')}</th>
                <th>{t('trips.table.price')}</th>
                <th>{t('trips.table.status')}</th>
                <th>{t('trips.table.created')}</th>
                <th>{t('trips.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">{t('trips.table.empty')}</td></tr>
              ) : trips.map(t_obj => (
                <tr key={t_obj.id}>
                  <td style={{ fontWeight: 500 }}>{t_obj.driver?.name || '—'}</td>
                  <td><span className="flex items-center gap-sm"><MapPin size={14} /> {t_obj.pickupLocation}</span></td>
                  <td>{t_obj.dropoffLocation}</td>
                  <td>
                    {t_obj.passengers && t_obj.passengers.length > 0 ? (
                      <span className="badge badge-neutral">{t_obj.passengers.length}</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td><span className="flex items-center gap-sm"><DollarSign size={14} /> {t_obj.price} {t('common.currency')}</span></td>
                  <td>
                    <span className={`badge badge-status ${STATUS_BADGES[t_obj.status] ?? STATUS_BADGES.DEFAULT}`}>
                      {t(`common.trip_status.${t_obj.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="text-muted text-sm">{formatDate(t_obj.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => setSelectedTrip(t_obj)} title={t('common.view')}><Eye size={16} /></button>
                      {(t_obj.status === 'ASSIGNED' || t_obj.status === 'IN_PROGRESS') && (
                        <button className="btn-icon text-danger" onClick={() => handleCancel(t_obj.id)} title={t('common.cancel')}>
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>{t('vehicles.pagination.prev')}</button>
          <span className="text-sm text-muted">
            {t('vehicles.pagination.info', { current: page, total: pagination.totalPages })}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>{t('vehicles.pagination.next')}</button>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('trips.modal.assign_title')}</h2>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
                <div className="form-section mb-md">
                <div className="card p-md mb-md" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-start justify-between" style={{ gap: 'var(--space-md)', marginBottom: '0.75rem' }}>
                    <div>
                      <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>Assignment charge</div>
                      <div className="text-sm" style={{ fontWeight: 650 }}>
                        {assignmentCharge.toFixed(2)} {t('common.currency')}
                        <span className="text-xs text-muted" style={{ marginInlineStart: '0.5rem' }}>(deducted from trip price)</span>
                      </div>
                    </div>
                     <button
                       type="button"
                       className="btn btn-secondary btn-sm"
                       disabled={savingCharge}
                       onClick={() => setConfirmSaveChargeOpen(true)}
                     >
                       <Save size={16} /> {t('common.save')}
                     </button>
                  </div>

                  <div className="grid grid-3 gap-md">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Charge (EGP)</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={chargeDraft}
                        onChange={(e) => setChargeDraft(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Trip price (EGP)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={form.price}
                        onChange={e => { setForm({ ...form, price: e.target.value }); setError(''); }}
                        required
                        placeholder={t('common.amount_placeholder')}
                        min="0"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Net to driver (EGP)</label>
                      <div className="form-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.95 }}>
                        <span style={{ fontWeight: 650 }}>
                          {(() => {
                            const parsed = Number(form.price);
                            if (!Number.isFinite(parsed)) return '—';
                            return (parsed - assignmentCharge).toFixed(2);
                          })()}
                        </span>
                        {(() => {
                          const parsed = Number(form.price);
                          if (!Number.isFinite(parsed)) return null;
                          return parsed - assignmentCharge < 0 ? (
                            <span className="text-xs text-danger" style={{ fontWeight: 650 }}>Price &lt; charge</span>
                          ) : (
                            <span className="text-xs text-muted">after charge</span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group mb-md">
                  <label className="form-label">{t('trips.modal.driver_label')}</label>
                  <select
                    className="form-input"
                    value={form.driverId}
                    onChange={e => {
                      const value = e.target.value;
                      const selected = drivers.find(d => String(d.id) === String(value));
                      setForm({ ...form, driverId: value });
                      setSelectedDriverName(selected?.name || '');
                    }}
                    required
                  >
                    <option value="">{t('trips.modal.select_driver')}</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.identityVerified ? t('common.shift_verification_status.verified') : t('common.shift_verification_status.pending')})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-2 gap-md mb-md">
                  <div className="form-group">
                    <label className="form-label">{t('trips.modal.pickup_label')}</label>
                    <input
                      className="form-input"
                      value={form.pickupLocation}
                      readOnly
                      required
                      placeholder={t('trips.modal.pickup_placeholder')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('trips.modal.dropoff_label')}</label>
                    <input
                      className="form-input"
                      value={form.dropoffLocation}
                      readOnly
                      required
                      placeholder={t('trips.modal.dropoff_placeholder')}
                    />
                  </div>
                </div>

                <div className="card mb-md" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                    <div className="flex gap-sm">
                      <button type="button" className={`btn btn-sm ${mapSelectionMode === 'pickup' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMapSelectionMode('pickup')}>
                        {t('trips.table.pickup')}
                      </button>
                      <button type="button" className={`btn btn-sm ${mapSelectionMode === 'dropoff' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMapSelectionMode('dropoff')}>
                        {t('trips.table.dropoff')}
                      </button>
                    </div>
                    <div className="text-xs text-muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="badge badge-neutral">{form.pickupLat != null && form.pickupLng != null ? `${t('trips.table.pickup')} pinned` : `${t('trips.table.pickup')}: not pinned`}</span>
                      <span className="badge badge-neutral">{form.dropoffLat != null && form.dropoffLng != null ? `${t('trips.table.dropoff')} pinned` : `${t('trips.table.dropoff')}: not pinned`}</span>
                    </div>
                  </div>
                  <div style={{ height: 260, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <MapContainer center={[30.0444, 31.2357]} zoom={12} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                        <TripMapClickHandler
                          selectionMode={mapSelectionMode}
                        onSelect={async (mode, lat, lng) => {
                          const address = await reverseGeocode(lat, lng, i18n.language);
                          if (mode === 'pickup') {
                            setForm((prev) => ({
                              ...prev,
                              pickupLat: lat,
                              pickupLng: lng,
                              pickupLocation: address || (prev.pickupLocation?.trim() ? prev.pickupLocation : 'Pinned pickup location'),
                            }));
                          } else {
                            setForm((prev) => ({
                              ...prev,
                              dropoffLat: lat,
                              dropoffLng: lng,
                              dropoffLocation: address || (prev.dropoffLocation?.trim() ? prev.dropoffLocation : 'Pinned dropoff location'),
                            }));
                          }
                        }}
                        />
                      {form.pickupLat != null && form.pickupLng != null && (
                        <Marker position={[form.pickupLat, form.pickupLng]} />
                      )}
                      {form.dropoffLat != null && form.dropoffLng != null && (
                        <Marker position={[form.dropoffLat, form.dropoffLng]} />
                      )}
                    </MapContainer>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('trips.modal.time_label')}</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.scheduledTime}
                    onChange={e => { setForm({ ...form, scheduledTime: e.target.value }); setError(''); }}
                    min={toLocalInputValue(new Date())}
                  />
                </div>
              </div>

              {/* Single Passenger Section */}
              <div className="form-section mb-md">
                <div className="flex justify-between items-center mb-md">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">{t('trips.modal.passengers_label')}</h3>
                </div>

                <div className="grid grid-1 gap-sm">
                  <div className="card p-md" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                    <div className="grid grid-2 gap-sm">
                      <div className="form-group">
                        <input
                          className="form-input text-sm"
                          placeholder={t('trips.modal.name_ph')}
                          value={form.passengers[0]?.name || ''}
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], name: e.target.value };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="tel"
                          className="form-input text-sm"
                          placeholder={t('trips.modal.phone_ph')}
                          value={form.passengers[0]?.phone || ''}
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], phone: e.target.value };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          pattern="^(?:\+201[0125]\d{8}|01[0125]\d{8})$"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ maxWidth: '180px' }}>
                        <label className="form-label">{t('trips.modal.companion_count_ph')}</label>
                        <input
                          type="number"
                          className="form-input text-sm"
                          placeholder={t('trips.modal.companion_count_ph')}
                          value={form.passengers[0]?.companionCount ?? 0}
                          min="0"
                          step="1"
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], companionCount: parseInt(e.target.value || '0', 10) };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ maxWidth: '180px' }}>
                        <label className="form-label">{t('trips.modal.bags_ph')}</label>
                        <input
                          type="number"
                          className="form-input text-sm"
                          placeholder={t('trips.modal.bags_ph')}
                          value={form.passengers[0]?.bagCount ?? 0}
                          min="0"
                          step="1"
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], bagCount: parseInt(e.target.value || '0', 10) };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('trips.assign_btn')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTrip && (
        <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('trips.modal.details_title')}</h2>
              <button className="btn-icon" onClick={() => setSelectedTrip(null)}>
                <XCircle size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="grid grid-2 gap-xl">
                <div className="form-section">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-md">{t('trips.modal.details_title')}</h3>
                  <div className="flex flex-col gap-md">
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.status')}</span>
                      <span className={`badge badge-status ${STATUS_BADGES[selectedTrip.status]}`}>{t(`common.trip_status.${selectedTrip.status.toLowerCase()}`)}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.table.driver')}</span>
                      <span className="font-medium">{selectedTrip.driver?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.vehicle')}</span>
                      <span className="font-medium">{selectedTrip.vehicle?.plateNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.pickup')}</span>
                      <span className="font-medium">{selectedTrip.pickupLocation}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.dropoff')}</span>
                      <span className="font-medium">{selectedTrip.dropoffLocation}</span>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMapDetails({ isOpen: true, trip: selectedTrip })}
                      >
                        <MapPin size={16} /> {t('trip.map_details')}
                      </button>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.price')}</span>
                      <span className="font-medium text-primary">{selectedTrip.price} {t('common.currency')}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.scheduled')}</span>
                      <span className="font-medium">{formatDate(selectedTrip.scheduledTime)}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.started')}</span>
                      <span className="font-medium">{formatDate(selectedTrip.actualStartTime)}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.ended')}</span>
                      <span className="font-medium">{formatDate(selectedTrip.actualEndTime)}</span>
                    </div>
                    {selectedTrip.cancellationReason && (
                      <div className="mt-md p-md rounded bg-danger-subtle border border-danger">
                        <span className="text-danger text-xs font-bold uppercase">{t('trips.details.cancel_reason')}</span>
                        <p className="mt-xs text-sm">{selectedTrip.cancellationReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-md">
                    {t('trips.modal.passengers_label')} ({selectedTrip.passengers?.length || 0})
                  </h3>
                  <div className="flex flex-col gap-sm">
                    {!selectedTrip.passengers || selectedTrip.passengers.length === 0 ? (
                      <p className="text-sm text-muted italic">{t('trips.modal.no_passengers')}</p>
                    ) : selectedTrip.passengers.map((p, idx) => (
                      <div key={idx} className="card p-md" style={{ background: 'var(--color-bg-subtle)' }}>
                        <div className="font-semibold text-primary mb-xs">{p.name}</div>
                        <div className="grid grid-2 gap-x-md gap-y-xs">
                          {p.phone && (
                            <div className="text-xs">
                              <span className="text-muted">{t('drivers.table.phone')}:</span> <span className="font-medium">{p.phone}</span>
                            </div>
                          )}
                          <div className="text-xs">
                            <span className="text-muted">{t('trips.modal.companion_count_ph')}:</span> <span className="font-medium">{p.companionCount ?? 0}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted">{t('trips.modal.bags_ph')}:</span> <span className="font-medium">{p.bagCount ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedTrip(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <PromptModal
        isOpen={promptData.isOpen}
        onClose={() => setPromptData({ isOpen: false, tripId: null })}
        onConfirm={onConfirmCancel}
        title={t('common.cancel')}
        message={t('trips.messages.cancel_prompt')}
        placeholder={t('trips.modal.reason_placeholder')}
      />

      <ConfirmModal
        isOpen={confirmSaveChargeOpen}
        onClose={() => setConfirmSaveChargeOpen(false)}
        onConfirm={saveAssignmentCharge}
        title={t('trips.messages.save_charge_confirm_title')}
        message={t('trips.messages.save_charge_confirm_message')}
        confirmText={t('common.save')}
        variant="primary"
      />

      <ConfirmModal
        isOpen={confirmAssignOpen}
        onClose={() => setConfirmAssignOpen(false)}
        onConfirm={submitAssignTrip}
        title={t('trips.assign_btn')}
        message={t('trips.messages.assign_confirm_message')}
        confirmText={t('trips.assign_btn')}
        variant="primary"
      />

      {mapDetails.isOpen && mapDetails.trip && (() => {
        const pickupLat = toCoord(mapDetails.trip.pickupLat);
        const pickupLng = toCoord(mapDetails.trip.pickupLng);
        const dropoffLat = toCoord(mapDetails.trip.dropoffLat);
        const dropoffLng = toCoord(mapDetails.trip.dropoffLng);

        const pickup = pickupLat != null && pickupLng != null ? [pickupLat, pickupLng] : null;
        const dropoff = dropoffLat != null && dropoffLng != null ? [dropoffLat, dropoffLng] : null;

        if (!pickup && !dropoff) {
          return (
            <div className="modal-overlay" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
              <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">{t('trip.map_details')}</h2>
                  <button className="btn-icon" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    {t('trip.location_not_available')}
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const center = pickup || dropoff;
        const polyline = [pickup, dropoff].filter(Boolean);

        return (
          <div className="modal-overlay" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
            <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{t('trip.map_details')}</h2>
                <button className="btn-icon" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ height: 520, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {polyline.length >= 2 && (
                      <Polyline positions={polyline} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.9 }} />
                    )}
                    {pickup && (
                      <Marker position={pickup} icon={TRIP_MARKER_ICONS.pickup}>
                        <Popup>
                          <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('trips.details.pickup')}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>{mapDetails.trip.pickupLocation || '—'}</div>
                        </Popup>
                      </Marker>
                    )}
                    {dropoff && (
                      <Marker position={dropoff} icon={TRIP_MARKER_ICONS.dropoff}>
                        <Popup>
                          <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('trips.details.dropoff')}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>{mapDetails.trip.dropoffLocation || '—'}</div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>

                <div className="grid grid-2 gap-md" style={{ marginTop: 'var(--space-md)' }}>
                  <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                    <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.details.pickup')}</div>
                    <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{mapDetails.trip.pickupLocation || '—'}</div>
                  </div>
                  <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                    <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.details.dropoff')}</div>
                    <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{mapDetails.trip.dropoffLocation || '—'}</div>
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
        );
      })()}
    </div>
  );
}
