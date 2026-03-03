import { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { vehicleService as api } from '../../services/vehicle.service';
import { ToastContext } from '../../contexts/toastContext';
import { Car, Plus, Search, Edit, Trash2, X, QrCode, Printer } from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import { QRCodeCanvas } from 'qrcode.react';

const STATUS_BADGES = {
  available: 'badge-success',
  assigned: 'badge-info',
  in_use: 'badge-warning',
  damaged: 'badge-danger',
  maintenance: 'badge-neutral',
};

export default function VehiclesPage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [vehicles, setVehicles] = useState([]);
  const [pagination, setPagination] = useState({});
  const [search, setSearch] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrVehicle, setQrVehicle] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [form, setForm] = useState({ plateNumber: '', model: '', year: 2024, capacity: 4, qrCode: '' });
  const [error, setError] = useState('');
  const [confirmData, setConfirmData] = useState({ isOpen: false, vehicleId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (availableOnly) params.set('availableOnly', 'true');
      const res = await api.getVehicles(params.toString());
      setVehicles(res.data.vehicles || []);
      setPagination(res.data || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, availableOnly]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleUpdate = () => load();
    window.addEventListener('ws:shift_activated', handleUpdate);
    window.addEventListener('ws:shift_closed', handleUpdate);
    window.addEventListener('ws:damage_reported', handleUpdate);
    window.addEventListener('ws:damage_reviewed', handleUpdate);
    return () => {
      window.removeEventListener('ws:shift_activated', handleUpdate);
      window.removeEventListener('ws:shift_closed', handleUpdate);
      window.removeEventListener('ws:damage_reported', handleUpdate);
      window.removeEventListener('ws:damage_reviewed', handleUpdate);
    };
  }, [load]);

  function openCreate() {
    setEditVehicle(null);
    setForm({ plateNumber: '', model: '', year: 2024, capacity: 4, qrCode: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(v) {
    setEditVehicle(v);
    setForm({ plateNumber: v.plateNumber, model: v.model, year: v.year, capacity: v.capacity, qrCode: v.qrCode });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = { ...form, year: parseInt(form.year), capacity: parseInt(form.capacity) };
      if (editVehicle) {
        await api.updateVehicle(editVehicle.id, data);
      } else {
        await api.createVehicle(data);
      }
      setShowModal(false);
      load();
    } catch (err) {
      const msg = err.errorCode ? t(`errors.${err.errorCode}`) : (err.message || t('vehicles.messages.op_failed'));
      addToast(msg, 'error');
    }
  }

  async function handleDelete(id) {
    setConfirmData({ isOpen: true, vehicleId: id });
  }

  async function onConfirmDelete() {
    try {
      await api.deleteVehicle(confirmData.vehicleId);
      load();
    } catch (err) {
      const msg = err.errorCode ? t(`errors.${err.errorCode}`) : err.message;
      addToast(msg, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('vehicles.title')}</h1>
          <p className="page-subtitle">{t('vehicles.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> {t('vehicles.add_btn')}
        </button>
      </div>

      <div className="card mb-md">
        <div className="flex items-center gap-md">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            className="form-input"
            placeholder={t('vehicles.search_placeholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.25rem' }}
          />
          <div className="flex items-center gap-sm" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1rem', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              id="availableOnly"
              checked={availableOnly}
              onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }}
            />
            <label htmlFor="availableOnly" className="text-sm font-medium cursor-pointer" style={{ whiteSpace: 'nowrap' }}>{t('vehicles.available_only')}</label>
          </div>
        </div>
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('vehicles.title')}</span>
              {availableOnly && <span className="badge badge-success">{t('vehicles.available_only')}</span>}
            </div>
            <span className="badge badge-info">{vehicles.length}</span>
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
                <th>{t('vehicles.table.plate')}</th>
                <th>{t('vehicles.table.model')}</th>
                <th>{t('vehicles.table.year')}</th>
                <th>{t('vehicles.table.capacity')}</th>
                <th>{t('vehicles.table.qr')}</th>
                <th>{t('vehicles.table.status')}</th>
                <th>{t('vehicles.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">{t('vehicles.table.empty')}</td></tr>
              ) : vehicles.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 500 }}>{v.plateNumber}</td>
                  <td>{v.model}</td>
                  <td>{v.year}</td>
                  <td>{t('vehicles.table.seats', { count: v.capacity })}</td>
                  <td><span className="flex items-center gap-sm"><QrCode size={14} /> {v.qrCode}</span></td>
                  <td>
                    <span className={`badge ${STATUS_BADGES[v.status] || 'badge-neutral'}`}>
                      {t(`common.status.${v.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-sm">
                      <button
                        className="btn-icon"
                        onClick={() => { setQrVehicle(v); setShowQRModal(true); }}
                        title={t('vehicles.table.view_qr')}
                      >
                        <QrCode size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => openEdit(v)} title={t('common.edit')}><Edit size={16} /></button>
                      <button className="btn-icon" onClick={() => handleDelete(v.id)} title={t('common.delete')} style={{ color: 'var(--color-danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      }

      {
        pagination.totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>{t('vehicles.pagination.prev')}</button>
            <span className="text-sm text-muted">
              {t('vehicles.pagination.info', { current: page, total: pagination.totalPages })}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>{t('vehicles.pagination.next')}</button>
          </div>
        )
      }

      {
        showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{editVehicle ? t('vehicles.modal.edit_title') : t('vehicles.modal.add_title')}</h2>
                <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="modal-body">
                <div className="form-section mb-md">
                  <div className="grid grid-2 gap-md">
                    <div className="form-group">
                      <label className="form-label">{t('vehicles.modal.plate_label')}</label>
                      <input className="form-input" name="plateNumber" value={form.plateNumber} onChange={e => setForm({ ...form, plateNumber: e.target.value })} required placeholder={t('vehicles.modal.plate_placeholder')} minLength={2} maxLength={50} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('vehicles.modal.model_label')}</label>
                      <input className="form-input" name="model" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} required placeholder={t('vehicles.modal.model_placeholder')} minLength={2} maxLength={100} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('vehicles.modal.year_label')}</label>
                      <input type="number" className="form-input" name="year" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} required min={2000} max={2030} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('vehicles.modal.capacity_label')}</label>
                      <input type="number" className="form-input" name="capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required min={1} max={50} />
                    </div>
                    <div className="form-group col-span-2">
                      <label className="form-label">{t('vehicles.modal.qr_label')}</label>
                      <input className="form-input" name="qrCode" value={form.qrCode} onChange={e => setForm({ ...form, qrCode: e.target.value })} required placeholder={t('vehicles.modal.qr_placeholder')} />
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                  <button type="submit" className="btn btn-primary">{editVehicle ? t('vehicles.modal.update_btn') : t('vehicles.modal.create_btn')}</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        showQRModal && qrVehicle && (
          <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2 className="modal-title">{t('vehicles.modal.qr_title')}</h2>
                <button className="btn-icon" onClick={() => setShowQRModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body text-center" style={{ padding: '2rem' }}>
                <div id="printable-qr" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', display: 'inline-block' }}>
                  <QRCodeCanvas
                    value={qrVehicle.qrCode}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                  <div style={{ marginTop: '1rem', color: 'black', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {qrVehicle.plateNumber}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.8rem' }}>
                    {qrVehicle.model} ({qrVehicle.year})
                  </div>
                </div>

                <div className="mt-xl flex flex-col gap-sm">
                  <button className="btn btn-primary w-full" onClick={() => window.print()}>
                    <Printer size={18} /> {t('common.print')}
                  </button>
                  <p className="text-xs text-muted mt-sm">
                    {t('vehicles.modal.qr_help')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-qr, #printable-qr * { visibility: visible; }
          #printable-qr {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            padding: 40px !important;
            border: 1px solid #eee;
          }
        }
      `}</style>

      <ConfirmModal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData({ isOpen: false, vehicleId: null })}
        onConfirm={onConfirmDelete}
        title={t('common.delete')}
        message={t('vehicles.messages.delete_confirm')}
      />
    </div >
  );
}

