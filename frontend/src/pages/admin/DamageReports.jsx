import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { damageService as api } from '../../services/damage.service';
import { AlertTriangle, Eye, CheckCircle, Wrench, X } from 'lucide-react';
import { useContext } from 'react';
import { ToastContext } from '../../contexts/toastContext';
import DetailModal from '../../components/common/DetailModal';

const STATUS_BADGES = { reported: 'badge-danger', acknowledged: 'badge-warning', maintenance: 'badge-info', resolved: 'badge-success' };

export default function DamageReportsPage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDamageReports(`page=${page}&limit=15`);
      setReports(res.data.reports || []);
      setPagination(res.data || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleUpdate = () => load();
    window.addEventListener('ws:damage_reported', handleUpdate);
    window.addEventListener('ws:damage_reviewed', handleUpdate);
    return () => {
      window.removeEventListener('ws:damage_reported', handleUpdate);
      window.removeEventListener('ws:damage_reviewed', handleUpdate);
    };
  }, [load]);

  async function handleReview(id, action) {
    try {
      await api.reviewDamageReport(id, { action });
      setSelected(null);
      load();
    } catch (err) { addToast(err.message || t('common.error'), 'error'); }
  }

  function formatDate(d) { return d ? new Date(d).toLocaleDateString() : '—'; }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin_damage.title')}</h1>
          <p className="page-subtitle">{t('admin_damage.subtitle')}</p>
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
        <div className="loading-page"><div className="spinner"></div></div>
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
              ) : reports.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.vehicle?.plateNumber || '—'}</td>
                  <td>{r.driver?.name || '—'}</td>
                  <td className="text-sm">{r.description?.substring(0, 60)}...</td>
                  <td><span className={`badge badge-status ${STATUS_BADGES[r.status]}`}>{t(`admin_damage.status.${r.status.toLowerCase()}`)}</span></td>
                  <td className="text-sm text-muted">{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => setSelected(r)} title={t('common.view')}><Eye size={16} /></button>
                      {r.status === 'reported' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleReview(r.id, 'acknowledged')}>
                          <CheckCircle size={14} /> {t('admin_damage.actions.acknowledge')}
                        </button>
                      )}
                      {r.status === 'acknowledged' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleReview(r.id, 'maintenance')}>
                          <Wrench size={14} /> {t('admin_damage.actions.maintenance')}
                        </button>
                      )}
                      {r.status === 'maintenance' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleReview(r.id, 'resolved')}>
                          <CheckCircle size={14} /> {t('admin_damage.actions.resolve')}
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
                <button className="btn btn-secondary" onClick={() => handleReview(selected.id, 'acknowledged')}>
                  <CheckCircle size={16} /> {t('admin_damage.actions.acknowledge')}
                </button>
              )}
              {selected.status === 'acknowledged' && (
                <button className="btn btn-secondary" onClick={() => handleReview(selected.id, 'maintenance')}>
                  <Wrench size={16} /> {t('admin_damage.actions.maintenance')}
                </button>
              )}
              {selected.status === 'maintenance' && (
                <button className="btn btn-success" onClick={() => handleReview(selected.id, 'resolved')}>
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
