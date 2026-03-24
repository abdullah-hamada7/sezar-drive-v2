import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { damageService as api } from '../../services/damage.service';
import { Eye, CheckCircle, Wrench, Download, Search } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import DetailModal from '../../components/common/DetailModal';
import Pagination from '../../components/common/Pagination';
import { ListError, ListLoading } from '../../components/common/ListStates';
import { downloadApiFile } from '../../utils/download';

const STATUS_BADGES = { reported: 'badge-danger', acknowledged: 'badge-warning', maintenance: 'badge-info', resolved: 'badge-success' };

export default function DamageReportsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || '15', 10) || 15;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams]);
  const status = useMemo(() => String(searchParams.get('status') || ''), [searchParams]);
  const search = useMemo(() => String(searchParams.get('search') || ''), [searchParams]);
  const startDate = useMemo(() => String(searchParams.get('startDate') || ''), [searchParams]);
  const endDate = useMemo(() => String(searchParams.get('endDate') || ''), [searchParams]);
  const sortBy = useMemo(() => String(searchParams.get('sortBy') || ''), [searchParams]);
  const sortOrder = useMemo(() => String(searchParams.get('sortOrder') || ''), [searchParams]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [reviewingIds, setReviewingIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);

      const res = await api.getDamageReports(params.toString());
      setReports(res.data.reports || []);
      setPagination(res.data || {});
    } catch (err) {
      console.error(err);
      const msg = err?.message || t('common.error');
      setLoadError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, endDate, limit, page, search, sortBy, sortOrder, startDate, status, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleUpdate = () => load();
    window.addEventListener('ws:damage_reported', handleUpdate);
    window.addEventListener('ws:damage_reviewed', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    return () => {
      window.removeEventListener('ws:damage_reported', handleUpdate);
      window.removeEventListener('ws:damage_reviewed', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
    };
  }, [load]);

  async function handleReview(id, action) {
    setReviewingIds((prev) => new Set([...prev, String(id)]));
    try {
      await api.reviewDamageReport(id, { action });
      setSelected(null);
      load();
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
    }
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleDateString(i18n.language) : '—';
  }

  function clearFilters() {
    setQuery({ page: 1, status: '', search: '', startDate: '', endDate: '', sortBy: '', sortOrder: '' });
  }

  const sortPreset = useMemo(() => {
    if (sortBy === 'status' && sortOrder === 'asc') return 'status_asc';
    if (sortBy === 'status' && sortOrder === 'desc') return 'status_desc';
    if (sortBy === 'createdAt' && sortOrder === 'asc') return 'created_asc';
    return 'created_desc';
  }, [sortBy, sortOrder]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);

      await downloadApiFile({
        endpoint: `/damage-reports/export?${params.toString()}`,
        filename: `damage-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin_damage.title')}</h1>
          <p className="page-subtitle">{t('admin_damage.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <Download size={18} />} {t('common.export_csv')}
          </button>
        </div>
      </div>

      <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="grid grid-4 gap-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.search')}</label>
            <div className="flex items-center gap-sm">
              <Search size={16} className="text-muted" />
              <input
                className="form-input"
                value={search}
                onChange={(e) => setQuery({ search: e.target.value, page: 1 })}
                placeholder={t('common.search')}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_damage.table.status')}</label>
            <select className="form-select" value={status} onChange={(e) => setQuery({ status: e.target.value, page: 1 })}>
              <option value="">{t('admin_expenses.filter.all')}</option>
              {['reported', 'acknowledged', 'maintenance', 'resolved'].map((s) => (
                <option key={s} value={s}>{t(`admin_damage.status.${s}`)}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.date_from')}</label>
            <input type="date" className="form-input" value={startDate} onChange={(e) => setQuery({ startDate: e.target.value, page: 1 })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.date_to')}</label>
            <input type="date" className="form-input" value={endDate} onChange={(e) => setQuery({ endDate: e.target.value, page: 1 })} />
          </div>
        </div>

        <div className="flex gap-sm mt-md" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.sort_by')}</label>
            <select
              className="form-select"
              value={sortPreset}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'created_asc') setQuery({ sortBy: 'createdAt', sortOrder: 'asc', page: 1 });
                else if (v === 'status_asc') setQuery({ sortBy: 'status', sortOrder: 'asc', page: 1 });
                else if (v === 'status_desc') setQuery({ sortBy: 'status', sortOrder: 'desc', page: 1 });
                else setQuery({ sortBy: 'createdAt', sortOrder: 'desc', page: 1 });
              }}
            >
              <option value="created_desc">{t('common.sort.newest')}</option>
              <option value="created_asc">{t('common.sort.oldest')}</option>
              <option value="status_desc">{t('common.sort.status_desc')}</option>
              <option value="status_asc">{t('common.sort.status_asc')}</option>
            </select>
          </div>
          <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', alignSelf: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters} disabled={!(status || search || startDate || endDate || sortBy || sortOrder)}>
              {t('common.filters.clear')}
            </button>
          </div>
        </div>
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('admin_damage.title')}</span>
            </div>
            <span className="badge badge-info">{reports.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <ListLoading />
      ) : loadError ? (
        <ListError message={loadError} onRetry={load} onClearFilters={clearFilters} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('admin_damage.table.vehicle')}</th>
                <th>{t('admin_damage.table.driver')}</th>
                <th>{t('admin_damage.table.description')}</th>
                <th>{t('admin_damage.table.status')}</th>
                <th>{t('admin_damage.table.reported')}</th>
                <th>{t('admin_damage.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">{t('admin_damage.table.empty')}</td></tr>
              ) : reports.map(r => {
                const isReviewing = reviewingIds.has(String(r.id));
                const description = String(r.description || '');
                const shortDesc = description.length > 60 ? `${description.slice(0, 60)}...` : (description || '—');
                return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.vehicle?.plateNumber || '—'}</td>
                  <td>{r.driver?.name || '—'}</td>
                  <td className="text-sm">{shortDesc}</td>
                  <td><span className={`badge badge-status ${STATUS_BADGES[r.status]}`}>{t(`admin_damage.status.${r.status.toLowerCase()}`)}</span></td>
                  <td className="text-sm text-muted">{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => setSelected(r)} title={t('common.view')} disabled={isReviewing}><Eye size={16} /></button>
                      {r.status === 'reported' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleReview(r.id, 'acknowledged')} disabled={isReviewing}>
                          <CheckCircle size={14} /> {t('admin_damage.actions.acknowledge')}
                        </button>
                      )}
                      {r.status === 'acknowledged' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleReview(r.id, 'maintenance')} disabled={isReviewing}>
                          <Wrench size={14} /> {t('admin_damage.actions.maintenance')}
                        </button>
                      )}
                      {r.status === 'maintenance' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleReview(r.id, 'resolved')} disabled={isReviewing}>
                          <CheckCircle size={14} /> {t('admin_damage.actions.resolve')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={(p) => setQuery({ page: p })}
        pageSize={limit}
        onPageSizeChange={(size) => setQuery({ limit: size, page: 1 })}
      />

      {selected && (
        <DetailModal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={t('admin_damage.modal.title')}
          size="modal-md"
          sections={[
            {
              title: t('common.details'),
              type: 'grid',
              items: [
                { label: t('admin_damage.table.vehicle'), value: selected.vehicle?.plateNumber },
                { label: t('admin_damage.table.driver'), value: selected.driver?.name },
                { label: t('admin_damage.table.reported'), value: formatDate(selected.createdAt) },
                {
                  label: t('admin_damage.table.status'),
                  value: t(`admin_damage.status.${selected.status.toLowerCase()}`),
                  type: 'badge',
                  badgeClass: STATUS_BADGES[selected.status]
                },
              ]
            },
            {
              title: t('admin_damage.table.description'),
              type: 'text',
              content: selected.description
            },
            {
              title: t('admin_damage.modal.photos'),
              type: 'photos',
              data: selected.photos?.map((p, i) => ({ photoUrl: p.photoUrl, label: `${t('damage.photos')} ${i + 1}` }))
            }
          ]}
          actions={
            <div className="flex gap-sm">
              {selected.status === 'reported' && (
                <button className="btn btn-secondary" onClick={() => handleReview(selected.id, 'acknowledged')} disabled={reviewingIds.has(String(selected.id))}>
                  <CheckCircle size={16} /> {t('admin_damage.actions.acknowledge')}
                </button>
              )}
              {selected.status === 'acknowledged' && (
                <button className="btn btn-secondary" onClick={() => handleReview(selected.id, 'maintenance')} disabled={reviewingIds.has(String(selected.id))}>
                  <Wrench size={16} /> {t('admin_damage.actions.maintenance')}
                </button>
              )}
              {selected.status === 'maintenance' && (
                <button className="btn btn-success" onClick={() => handleReview(selected.id, 'resolved')} disabled={reviewingIds.has(String(selected.id))}>
                  <CheckCircle size={16} /> {t('admin_damage.actions.resolve')}
                </button>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
