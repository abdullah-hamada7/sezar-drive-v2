import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { tripService as api } from '../../services/trip.service';
import { driverService } from '../../services/driver.service';
import { ToastContext } from '../../contexts/toastContext';
import { Route, Search, Eye, XCircle, MapPin, Clock, DollarSign } from 'lucide-react';
import PromptModal from '../../components/common/PromptModal';

const STATUS_BADGES = {
  ASSIGNED: 'badge-info',
  IN_PROGRESS: 'badge-warning',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
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
    price: '',
    scheduledTime: '',
    passengers: []
  });
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [promptData, setPromptData] = useState({ isOpen: false, tripId: null });
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
    const handleUpdate = () => setRefresh(r => r + 1);
    window.addEventListener('ws:trip_assigned', handleUpdate);
    window.addEventListener('ws:trip_started', handleUpdate);
    window.addEventListener('ws:trip_completed', handleUpdate);
    window.addEventListener('ws:trip_cancelled', handleUpdate);
    return () => {
      window.removeEventListener('ws:trip_assigned', handleUpdate);
      window.removeEventListener('ws:trip_started', handleUpdate);
      window.removeEventListener('ws:trip_completed', handleUpdate);
      window.removeEventListener('ws:trip_cancelled', handleUpdate);
    };
  }, []);

  async function openCreate() {
    setError('');
    setShowCreateModal(true);
    try {
      const res = await driverService.getDrivers('limit=100');
      setDrivers(res.data.drivers || []);
    } catch (err) { console.error(err); }
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

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!form.driverId) {
      setError(t('trips.modal.select_driver'));
      return;
    }
    const parsedPrice = parseFloat(form.price);
    if (Number.isNaN(parsedPrice)) {
      setError(t('trips.modal.price_label', { unit: t('common.currency') }));
      return;
    }
    try {
      let scheduledTime = form.scheduledTime;
      if (scheduledTime) {
        const scheduledDate = new Date(scheduledTime);
        if (!Number.isNaN(scheduledDate.getTime())) {
          scheduledTime = toOffsetISOString(scheduledDate);
        }
      }
      await api.assignTrip({ ...form, price: parsedPrice, scheduledTime });
      setShowCreateModal(false);
      setForm({ driverId: '', pickupLocation: '', dropoffLocation: '', price: '', scheduledTime: '', passengers: [] });
      setSelectedDriverName('');
      setRefresh(r => r + 1);
    } catch (err) {
      const driverName = selectedDriverName || drivers.find(d => String(d.id) === String(form.driverId))?.name || '';
      setError(err.code ? t(`errors.${err.code}`, { name: driverName }) : err.message);
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
            {s ? t(`common.status.${s.toLowerCase()}`) : t('trips.filter_all')}
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
                <tr><td colSpan={7} className="empty-state">{t('trips.table.empty')}</td></tr>
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
                    <span className={`badge ${STATUS_BADGES[t_obj.status] || 'badge-neutral'}`}>{t(`common.status.${t_obj.status.toLowerCase()}`)}</span>
                  </td>
                  <td className="text-muted text-sm">{formatDate(t_obj.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => setSelectedTrip(t_obj)} title={t('common.view')}><Eye size={16} /></button>
                      {(t_obj.status === 'ASSIGNED' || t_obj.status === 'IN_PROGRESS') && (
                        <button className="btn-icon" onClick={() => handleCancel(t_obj.id)} title={t('common.cancel')} style={{ color: 'var(--color-danger)' }}>
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

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleCreate} className="modal-body">
              <div className="form-section mb-md">
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
                      setError('');
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
                    <input className="form-input" value={form.pickupLocation} onChange={e => { setForm({ ...form, pickupLocation: e.target.value }); setError(''); }} required placeholder={t('trips.modal.pickup_placeholder')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('trips.modal.dropoff_label')}</label>
                    <input className="form-input" value={form.dropoffLocation} onChange={e => { setForm({ ...form, dropoffLocation: e.target.value }); setError(''); }} required placeholder={t('trips.modal.dropoff_placeholder')} />
                  </div>
                </div>

                <div className="grid grid-2 gap-md">
                  <div className="form-group">
                    <label className="form-label">{t('trips.modal.price_label', { unit: t('common.currency') })}</label>
                    <input type="number" step="0.01" className="form-input" value={form.price} onChange={e => { setForm({ ...form, price: e.target.value }); setError(''); }} required placeholder="0.00" />
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
              </div>

              {/* Dynamic Passengers Section */}
              <div className="form-section mb-md">
                <div className="flex justify-between items-center mb-md">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">{t('trips.modal.passengers_label')}</h3>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setForm({
                      ...form,
                      passengers: [...form.passengers, { name: '', phone: '', pickup: '', bags: 0 }]
                    })}
                  >
                    {t('trips.modal.add_passenger')}
                  </button>
                </div>

                <div className="grid grid-1 gap-sm">
                  {form.passengers.length === 0 ? (
                    <p className="text-sm text-center text-muted py-md border-dashed border-2 rounded-lg">{t('trips.modal.no_passengers')}</p>
                  ) : form.passengers.map((p, idx) => (
                    <div key={idx} className="card p-md" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                      <div className="flex justify-between items-center mb-sm">
                        <span className="text-xs font-bold uppercase tracking-tight text-primary">{t('trips.modal.passenger_num', { count: idx + 1 })}</span>
                        <button
                          type="button"
                          className="btn-icon text-danger"
                          onClick={() => {
                            const newPassengers = [...form.passengers];
                            newPassengers.splice(idx, 1);
                            setForm({ ...form, passengers: newPassengers });
                          }}
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                      <div className="grid grid-2 gap-sm">
                        <div className="form-group">
                          <input
                            className="form-input text-sm"
                            placeholder={t('trips.modal.name_ph')}
                            value={p.name}
                            onChange={e => {
                              const newPassengers = [...form.passengers];
                              newPassengers[idx].name = e.target.value;
                              setForm({ ...form, passengers: newPassengers });
                            }}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <input
                            className="form-input text-sm"
                            placeholder={t('trips.modal.phone_ph')}
                            value={p.phone}
                            onChange={e => {
                              const newPassengers = [...form.passengers];
                              newPassengers[idx].phone = e.target.value;
                              setForm({ ...form, passengers: newPassengers });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <input
                            className="form-input text-sm"
                            placeholder={t('trips.modal.pickup_ph')}
                            value={p.pickup}
                            onChange={e => {
                              const newPassengers = [...form.passengers];
                              newPassengers[idx].pickup = e.target.value;
                              setForm({ ...form, passengers: newPassengers });
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <input
                            type="number"
                            className="form-input text-sm"
                            placeholder={t('trips.modal.bags_ph')}
                            min="0"
                            value={p.bags || ''}
                            onChange={e => {
                              const newPassengers = [...form.passengers];
                              newPassengers[idx].bags = parseInt(e.target.value) || 0;
                              setForm({ ...form, passengers: newPassengers });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
                      <span className={`badge ${STATUS_BADGES[selectedTrip.status]}`}>{t(`common.status.${selectedTrip.status.toLowerCase()}`)}</span>
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
                      <p className="text-sm text-muted italic">{t('trips.table.empty')}</p>
                    ) : selectedTrip.passengers.map((p, idx) => (
                      <div key={idx} className="card p-md" style={{ background: 'var(--color-bg-subtle)' }}>
                        <div className="font-semibold text-primary mb-xs">{p.name}</div>
                        <div className="grid grid-2 gap-x-md gap-y-xs">
                          {p.phone && (
                            <div className="text-xs">
                              <span className="text-muted">{t('drivers.table.phone')}:</span> <span className="font-medium">{p.phone}</span>
                            </div>
                          )}
                          {p.pickup && (
                            <div className="text-xs">
                              <span className="text-muted">{t('trips.details.pickup')}:</span> <span className="font-medium">{p.pickup}</span>
                            </div>
                          )}
                          <div className="text-xs">
                            <span className="text-muted">{t('trips.modal.bags_ph')}:</span> <span className="font-medium">{p.bags || 0}</span>
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
    </div>
  );
}
