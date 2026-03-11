import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { auditService as api } from '../../services/audit.service';
import { Shield, Search, Filter, Eye, X, Calendar, User, Tag } from 'lucide-react';

export default function AuditPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    entityType: '',
    actionType: '',
    startDate: '',
    endDate: '',
    actorSearch: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.actionType) params.set('actionType', filters.actionType);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.actorSearch) params.set('actorSearch', filters.actorSearch);
      const res = await api.getAuditLogs(params.toString());
      setLogs(res.data.logs || []);
      setPagination(res.data || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, filters]);

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
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('ws:notification', handleUpdate);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
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
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="grid grid-4" style={{ gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Tag size={14} /> {t('audit.filter.entity_type')}</label>
            <select className="form-select" name="entityType" value={filters.entityType} onChange={handleFilterChange}>
              <option value="">{t('audit.filter.all_entities')}</option>
              {entities.filter(Boolean).map(e => (
                <option key={e} value={e}>{t(`audit.entity.${e}`, e.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Search size={14} /> {t('audit.filter.action_type')}</label>
            <input type="text" className="form-input" name="actionType" placeholder={t('audit.filter.action_ph')} value={filters.actionType} onChange={handleFilterChange} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Calendar size={14} /> {t('audit.filter.from')}</label>
            <input type="date" className="form-input" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label flex items-center gap-sm"><Calendar size={14} /> {t('audit.filter.to')}</label>
            <input type="date" className="form-input" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
          </div>
        </div>
        <div className="flex gap-sm mt-md">
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label flex items-center gap-sm"><User size={14} /> {t('audit.filter.actor_search')}</label>
            <input type="text" className="form-input" name="actorSearch" placeholder={t('audit.filter.actor_ph')} value={filters.actorSearch} onChange={handleFilterChange} />
          </div>
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={() => {
            setFilters({ entityType: '', actionType: '', startDate: '', endDate: '', actorSearch: '' });
            setPage(1);
          }}>{t('audit.filter.clear_btn')}</button>
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
        <div className="loading-page" style={{ minHeight: '300px' }}><div className="spinner"></div></div>
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
                  <td className="text-sm text-muted" style={{ fontFamily: 'monospace' }} dir="ltr">{l.entityId?.slice(0, 8)}...</td>
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

      {pagination.totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '1.5rem' }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>{t('vehicles.pagination.prev')}</button>
          <div className="flex items-center gap-sm">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
              );
            })}
            {pagination.totalPages > 5 && <span className="text-muted">...</span>}
            {pagination.totalPages > 5 && (
              <button className={page === pagination.totalPages ? 'active' : ''} onClick={() => setPage(pagination.totalPages)}>
                {pagination.totalPages}
              </button>
            )}
          </div>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>{t('vehicles.pagination.next')}</button>
        </div>
      )}

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
