import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auditService as api } from '../../services/audit.service';
import { Eye, X, Calendar, User, Tag, Download, ExternalLink, Search } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import Pagination from '../../components/common/Pagination';
import { ListError, ListLoading } from '../../components/common/ListStates';
import { downloadApiFile } from '../../utils/download';

export default function AuditPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || '25', 10) || 25;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams]);
  const entityType = useMemo(() => String(searchParams.get('entityType') || ''), [searchParams]);
  const actionType = useMemo(() => String(searchParams.get('actionType') || ''), [searchParams]);
  const startDate = useMemo(() => String(searchParams.get('startDate') || ''), [searchParams]);
  const endDate = useMemo(() => String(searchParams.get('endDate') || ''), [searchParams]);
  const actorSearch = useMemo(() => String(searchParams.get('actorSearch') || ''), [searchParams]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (entityType) params.set('entityType', entityType);
      if (actionType) params.set('actionType', actionType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (actorSearch) params.set('actorSearch', actorSearch);
      const res = await api.getAuditLogs(params.toString());
      setLogs(res.data.logs || []);
      setPagination(res.data || {});
    } catch (err) {
      console.error(err);
      const msg = err?.message || t('common.error');
      setLoadError(msg);
      addToast(msg, 'error');
    }
    finally { setLoading(false); }
  }, [actionType, actorSearch, addToast, endDate, entityType, limit, page, startDate, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleUpdate = () => load();

    const handleOnline = () => load();

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      load();
    };

    const poll = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      load();
    }, 20000);

    window.addEventListener('ws:notification', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('ws:notification', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setQuery({ [name]: value, page: 1 });
  }

  function clearFilters() {
    setQuery({ entityType: '', actionType: '', startDate: '', endDate: '', actorSearch: '', page: 1 });
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      if (actionType) params.set('actionType', actionType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (actorSearch) params.set('actorSearch', actorSearch);
      await downloadApiFile({
        endpoint: `/audit-logs/export?${params.toString()}`,
        filename: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  function openEntity(entity, id) {
    const e = String(entity || '').toLowerCase();
    const entityId = String(id || '').trim();
    if (!entityId) return;
    if (e === 'trip') navigate(`/admin/trips?tripId=${encodeURIComponent(entityId)}`);
    else if (e === 'driver') navigate(`/admin/drivers?search=${encodeURIComponent(entityId)}`);
    else if (e === 'vehicle') navigate(`/admin/vehicles?search=${encodeURIComponent(entityId)}`);
    else if (e === 'expense') navigate(`/admin/expenses?expenseId=${encodeURIComponent(entityId)}`);
    else if (e === 'damage_report') navigate(`/admin/damage-reports?search=${encodeURIComponent(entityId)}`);
  }

  function formatDate(d) {
    return new Date(d).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'medium' });
  }

  function translateState(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const translated = {};
    for (const [key, value] of Object.entries(obj)) {
      const translatedKey = t(`audit.fields.${key}`, key);
      let translatedValue = value;
      if (key === 'status') {
        translatedValue = t(`common.status.${String(value).toLowerCase()}`, String(value));
      }
      translated[translatedKey] = translatedValue;
    }
    return translated;
  }

  const entities = ['', 'user', 'driver', 'vehicle', 'shift', 'trip', 'expense', 'damage_report', 'inspection'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('audit.title')}</h1>
          <p className="page-subtitle">{t('audit.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <Download size={18} />} {t('common.export_csv')}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="grid grid-4" style={{ gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Tag size={14} /> {t('audit.filter.entity_type')}</label>
            <select className="form-select" name="entityType" value={entityType} onChange={handleFilterChange}>
              <option value="">{t('audit.filter.all_entities')}</option>
              {entities.filter(Boolean).map(e => (
                <option key={e} value={e}>{t(`audit.entity.${e}`, e.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Search size={14} /> {t('audit.filter.action_type')}</label>
            <input type="text" className="form-input" name="actionType" placeholder={t('audit.filter.action_ph')} value={actionType} onChange={handleFilterChange} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Calendar size={14} /> {t('audit.filter.from')}</label>
            <input type="date" className="form-input" name="startDate" value={startDate} onChange={handleFilterChange} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Calendar size={14} /> {t('audit.filter.to')}</label>
            <input type="date" className="form-input" name="endDate" value={endDate} onChange={handleFilterChange} />
          </div>
        </div>
        <div className="flex gap-sm mt-md">
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label flex items-center gap-sm"><User size={14} /> {t('audit.filter.actor_search')}</label>
            <input type="text" className="form-input" name="actorSearch" placeholder={t('audit.filter.actor_ph')} value={actorSearch} onChange={handleFilterChange} />
          </div>
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={clearFilters}>{t('audit.filter.clear_btn')}</button>
        </div>
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('audit.title')}</span>
            </div>
            <span className="badge badge-info">{logs.length}</span>
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
                <th>{t('audit.table.timestamp')}</th>
                <th>{t('audit.table.actor')}</th>
                <th>{t('audit.table.role')}</th>
                <th>{t('audit.table.action')}</th>
                <th>{t('audit.table.entity')}</th>
                <th>{t('audit.table.entity_id')}</th>
                <th>{t('audit.table.details')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">{t('audit.table.empty')}</td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{formatDate(l.createdAt)}</td>
                  <td className="text-sm">
                    <div style={{ fontWeight: 500 }}>{l.actor?.name || t('dashboard.activity.system')}</div>
                    <div className="text-sm text-muted">{l.actor?.email}</div>
                  </td>
                  <td className="text-sm">
                    {(() => {
                      const actorRole = l.actor?.role ?? 'system';
                      return (
                        <span className={`badge badge-status ${l.actor?.role === 'admin' ? 'badge-info' : 'badge-neutral'}`}>
                          {t(`common.role.${actorRole}`)}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ background: 'var(--color-bg-tertiary)' }}>
                      {t(`audit.action.${l.actionType?.split('.').pop()?.toLowerCase()}`, l.actionType)}
                    </span>
                  </td>
                  <td className="text-sm">{t(`audit.entity.${l.entityType?.toLowerCase()}`, l.entityType)}</td>
                  <td className="text-sm text-muted" style={{ fontFamily: 'monospace' }} dir="ltr">
                    <div className="flex items-center gap-sm">
                      <span>{l.entityId ? (l.entityId.length > 10 ? `${l.entityId.slice(0, 8)}...` : l.entityId) : '—'}</span>
                      {l.entityId && (
                        <button
                          type="button"
                          className="btn-icon"
                          title={t('common.view')}
                          onClick={() => openEntity(l.entityType, l.entityId)}
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <button className="btn-icon" title={t('audit.table.details')} onClick={() => setSelected(l)}>
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
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

      {/* Details Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('audit.modal.title')}</h2>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-2 mb-lg" style={{ gap: '1rem' }}>
              <div className="card" style={{ padding: '0.75rem 1rem' }}>
                <label className="form-label">{t('audit.modal.action')}</label>
                <div className="text-sm" style={{ fontWeight: 700 }}>
                  {t(`audit.action.${selected.actionType?.split('.').pop()?.toLowerCase()}`, selected.actionType)}
                </div>
              </div>

              <div className="card" style={{ padding: '0.75rem 1rem' }}>
                <label className="form-label">{t('audit.modal.entity')}</label>
                <div className="text-sm">
                  {t(`audit.entity.${selected.entityType?.toLowerCase()}`, selected.entityType)}
                  <span className="text-xs text-muted" style={{ marginLeft: '0.5rem' }}>({selected.entityId})</span>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEntity(selected.entityType, selected.entityId)}>
                    <ExternalLink size={14} /> {t('common.view')}
                  </button>
                </div>
              </div>
              <div className="card" style={{ padding: '0.75rem 1rem' }}>
                <label className="form-label">{t('audit.modal.timestamp')}</label>
                <div className="text-sm">{formatDate(selected.createdAt)}</div>
              </div>
              <div className="card" style={{ padding: '0.75rem 1rem' }}>
                <label className="form-label">{t('audit.modal.ip')}</label>
                <div className="text-sm">{selected.ipAddress || '—'}</div>
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: '1.5rem' }}>
              <div>
                <label className="form-label" style={{ color: 'var(--color-danger)' }}>{t('audit.modal.prev_state')}</label>
                <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} style={{
                  background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, var(--color-bg) 70%)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  overflowX: 'auto',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}>
                  <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                    {JSON.stringify(translateState(selected.previousState || {}), null, 2)}
                  </pre>
                </div>
              </div>
              <div>
                <label className="form-label" style={{ color: 'var(--color-success)' }}>{t('audit.modal.new_state')}</label>
                <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} style={{
                  background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, var(--color-bg) 70%)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  overflowX: 'auto',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}>
                  <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                    {JSON.stringify(translateState(selected.newState || {}), null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {selected.metadata && (
              <div className="mt-lg">
                <label className="form-label">{t('audit.modal.metadata')}</label>
                <pre dir="ltr" style={{
                  background: 'var(--color-bg-tertiary)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  border: '1px solid var(--color-border)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }}>
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
