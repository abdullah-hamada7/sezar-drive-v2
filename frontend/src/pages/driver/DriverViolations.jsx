import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import violationService from '../../services/violation.service';

export default function DriverViolationsPage() {
  const { t, i18n } = useTranslation();
  const [violations, setViolations] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = useMemo(() => {
    const next = { page: String(page), limit: '15' };
    if (search) next.search = search;
    if (startDate) next.startDate = startDate;
    if (endDate) next.endDate = endDate;
    return next;
  }, [page, search, startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await violationService.getMyViolations(params);
        if (!mounted) return;
        setViolations(res.data?.data || []);
        setPagination(res.data?.pagination || {});
      } catch (err) {
        if (!mounted) return;
        setViolations([]);
        setPagination({});
        // Global toast is handled by HttpService; keep this page silent.
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [params]);

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
          <h1 className="page-title">{t('driver_violations.title')}</h1>
          <p className="page-subtitle">{t('driver_violations.subtitle')}</p>
        </div>
      </div>

      <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="grid grid-3 gap-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('driver_violations.from_date')}</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('driver_violations.to_date')}</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('violations.search')}</label>
            <div className="flex gap-sm">
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 32 }}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t('violations.search_placeholder')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner"></div></div>
      ) : (
        <div className="table-container">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>{t('violations.date')}</th>
                  <th>{t('violations.time')}</th>
                  <th>{t('violations.location')}</th>
                  <th>{t('violations.violation_number')}</th>
                  <th>{t('violations.photo')}</th>
                  <th>{t('violations.vehicle')}</th>
                  <th>{t('violations.fine_amount')}</th>
                </tr>
              </thead>
              <tbody>
                {violations.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">{t('violations.empty')}</td></tr>
                ) : violations.map(v => (
                  <tr key={v.id}>
                    <td>{formatDate(v.date)}</td>
                    <td>{v.time || '—'}</td>
                    <td className="text-sm">{v.location || '—'}</td>
                    <td>{v.violationNumber || '—'}</td>
                    <td>
                      {v.photoUrl ? (
                        <a
                          href={v.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                          title={t('violations.photo')}
                        >
                          <img
                            src={v.photoUrl}
                            alt={t('violations.photo')}
                            style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }}
                          />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{v.vehicle?.plateNumber || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{formatMoney(v.fineAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>{t('common.prev')}</button>
          <span className="text-sm text-muted">{page} / {pagination.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}
