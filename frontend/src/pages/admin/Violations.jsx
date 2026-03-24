import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import violationService from '../../services/violation.service';
import { useContext } from 'react';
import { ToastContext } from '../../contexts/toastContext';
import DetailModal from '../../components/common/DetailModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { Plus, Edit, Trash2, Eye, X, Download } from 'lucide-react';
import Pagination from '../../components/common/Pagination';
import { ListError, ListLoading } from '../../components/common/ListStates';
import { downloadApiFile } from '../../utils/download';

export default function ViolationsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || '15', 10) || 15;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams]);
  const search = useMemo(() => String(searchParams.get('search') || ''), [searchParams]);
  const driverId = useMemo(() => String(searchParams.get('driverId') || ''), [searchParams]);
  const vehicleId = useMemo(() => String(searchParams.get('vehicleId') || ''), [searchParams]);
  const startDate = useMemo(() => String(searchParams.get('startDate') || ''), [searchParams]);
  const endDate = useMemo(() => String(searchParams.get('endDate') || ''), [searchParams]);
  const sortBy = useMemo(() => String(searchParams.get('sortBy') || 'date'), [searchParams]);
  const sortOrder = useMemo(() => String(searchParams.get('sortOrder') || 'desc'), [searchParams]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === false) next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [violations, setViolations] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [formData, setFormData] = useState({
    driverId: '',
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    location: '',
    violationNumber: '',
    fineAmount: '',
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const [driversRes, vehiclesRes] = await Promise.all([
          violationService.getDrivers(),
          violationService.getVehicles(),
        ]);
        setDrivers(driversRes.data || []);
        setVehicles(vehiclesRes.data || []);
      } catch (err) { console.error(err); }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const params = {
          page,
          limit,
          ...(search && { search }),
          ...(driverId && { driverId }),
          ...(vehicleId && { vehicleId }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
          ...(sortBy && { sortBy }),
          ...(sortOrder && { sortOrder }),
        };
        const res = await violationService.getViolations(params);
        setViolations(res.data?.data || []);
        setPagination(res.data?.pagination || {});
      } catch (err) {
        console.error(err);
        const msg = err?.message || t('common.error');
        setLoadError(msg);
        addToast(msg, 'error');
      }
      finally { setLoading(false); }
    }
    load();
  }, [addToast, driverId, endDate, limit, page, refresh, search, sortBy, sortOrder, startDate, t, vehicleId]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        search,
        driverId,
        vehicleId,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      });
      await downloadApiFile({
        endpoint: `/violations/export?${params.toString()}`,
        filename: `violations-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (selected?.id) {
        await violationService.updateViolation(selected.id, formData);
        addToast(t('violations.update_success'), 'success');
      } else {
        await violationService.createViolation(formData);
        addToast(t('violations.create_success'), 'success');
      }
      setIsEditing(false);
      setSelected(null);
      setFormData({
        driverId: '',
        vehicleId: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        location: '',
        violationNumber: '',
        fineAmount: '',
      });
      setRefresh(r => r + 1);
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    }
  }

  async function handleDelete(id) {
    try {
      await violationService.deleteViolation(id);
      addToast(t('violations.delete_success'), 'success');
      setDeleteConfirm(null);
      setRefresh(r => r + 1);
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    }
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleDateString(i18n.language) : '—';
  }

  function formatMoney(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const formatted = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    return `${formatted} ${t('common.currency')}`;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('violations.title')}</h1>
          <p className="page-subtitle">{t('violations.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <Download size={18} />} {t('common.export_csv')}
          </button>
          <button className="btn btn-primary" onClick={() => { setIsEditing(true); setSelected(null); setFormData({
            driverId: '',
            vehicleId: '',
            date: new Date().toISOString().split('T')[0],
            time: '',
            location: '',
            violationNumber: '',
            fineAmount: '',
          }); }}>
            <Plus size={18} /> {t('violations.add')}
          </button>
        </div>
      </div>

      <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="grid grid-4 gap-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('violations.search')}</label>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setQuery({ search: e.target.value, page: 1 })}
              placeholder={t('violations.search_placeholder')}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('violations.driver')}</label>
            <select className="form-select" value={driverId} onChange={(e) => setQuery({ driverId: e.target.value, page: 1 })}>
              <option value="">{t('common.select')}...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('violations.vehicle')}</label>
            <select className="form-select" value={vehicleId} onChange={(e) => setQuery({ vehicleId: e.target.value, page: 1 })}>
              <option value="">{t('common.select')}...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plateNumber}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setQuery({ search: '', driverId: '', vehicleId: '', startDate: '', endDate: '', page: 1 })}
              disabled={!search && !driverId && !vehicleId && !startDate && !endDate}
            >
              {t('common.filters.clear')}
            </button>
          </div>
        </div>
        <div className="grid grid-4 gap-md mt-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('reports.filter.start')}</label>
            <input type="date" className="form-input" value={startDate} onChange={(e) => setQuery({ startDate: e.target.value, page: 1 })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('reports.filter.end')}</label>
            <input type="date" className="form-input" value={endDate} onChange={(e) => setQuery({ endDate: e.target.value, page: 1 })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.sort_by')}</label>
            <select className="form-select" value={`${sortBy}:${sortOrder}`} onChange={(e) => {
              const [sb, so] = String(e.target.value).split(':');
              setQuery({ sortBy: sb, sortOrder: so, page: 1 });
            }}>
              <option value="date:desc">{t('violations.date')} ↓</option>
              <option value="date:asc">{t('violations.date')} ↑</option>
              <option value="fineAmount:desc">{t('violations.fine_amount')} ↓</option>
              <option value="fineAmount:asc">{t('violations.fine_amount')} ↑</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <ListLoading />
      ) : loadError ? (
        <ListError message={loadError} onRetry={() => setQuery({ page })} onClearFilters={() => setQuery({ search: '', driverId: '', vehicleId: '', startDate: '', endDate: '', page: 1 })} />
      ) : (
        <div className="table-container">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>{t('violations.driver')}</th>
                  <th>{t('violations.vehicle')}</th>
                  <th>{t('violations.date')}</th>
                  <th>{t('violations.time')}</th>
                  <th>{t('violations.location')}</th>
                  <th>{t('violations.violation_number')}</th>
                  <th>{t('violations.fine_amount')}</th>
                  <th>{t('violations.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {violations.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">{t('violations.empty')}</td></tr>
                ) : violations.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 500 }}>{v.driver?.name || '—'}</td>
                    <td>{v.vehicle?.plateNumber || '—'}</td>
                    <td>{formatDate(v.date)}</td>
                    <td>{v.time || '—'}</td>
                    <td className="text-sm">{v.location || '—'}</td>
                    <td>{v.violationNumber || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{formatMoney(v.fineAmount)}</td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn-icon" onClick={() => setSelected(v)} title={t('common.view')}><Eye size={16} /></button>
                        <button className="btn-icon" onClick={() => { setSelected(v); setIsEditing(true); setFormData({
                          driverId: v.driverId,
                          vehicleId: v.vehicleId,
                          date: v.date?.split('T')[0] || '',
                          time: v.time || '',
                          location: v.location || '',
                          violationNumber: v.violationNumber || '',
                          fineAmount: v.fineAmount?.toString() || '',
                        }); }} title={t('common.edit')}><Edit size={16} /></button>
                        <button className="btn-icon" onClick={() => setDeleteConfirm(v.id)} style={{ color: 'var(--color-danger)' }} title={t('common.delete')}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={(nextPage) => setQuery({ page: nextPage })}
        pageSize={limit}
        onPageSizeChange={(nextLimit) => setQuery({ limit: nextLimit, page: 1 })}
      />

      {isEditing && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{selected ? t('violations.edit_title') : t('violations.add_title')}</h3>
              <button className="btn-icon" onClick={() => { setIsEditing(false); setSelected(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid grid-2 gap-md">
                  <div className="form-group">
                    <label className="form-label">{t('violations.driver')} *</label>
                    <select
                      className="form-input"
                      value={formData.driverId}
                      onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                      required
                    >
                      <option value="">{t('common.select')}...</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('violations.vehicle')} *</label>
                    <select
                      className="form-input"
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                      required
                    >
                      <option value="">{t('common.select')}...</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('violations.date')} *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('violations.time')} *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('violations.location')} *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('violations.violation_number')} *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.violationNumber}
                      onChange={(e) => setFormData({ ...formData, violationNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">{t('violations.fine_amount')} *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formData.fineAmount}
                      onChange={(e) => setFormData({ ...formData, fineAmount: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsEditing(false); setSelected(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && !isEditing && (
        <DetailModal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={t('violations.details')}
          size="modal-md"
          sections={[
            {
              title: t('common.details'),
              type: 'grid',
              items: [
                { label: t('violations.driver'), value: selected.driver?.name },
                { label: t('violations.vehicle'), value: selected.vehicle?.plateNumber },
                { label: t('violations.date'), value: formatDate(selected.date) },
                { label: t('violations.time'), value: selected.time },
                { label: t('violations.location'), value: selected.location },
                { label: t('violations.violation_number'), value: selected.violationNumber },
                { label: t('violations.fine_amount'), value: formatMoney(selected.fineAmount), type: 'badge', badgeClass: 'badge-danger' },
              ]
            }
          ].filter(Boolean)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm)}
        title={t('violations.delete_title')}
        message={t('violations.delete_confirm')}
        variant="danger"
      />
    </div>
  );
}
