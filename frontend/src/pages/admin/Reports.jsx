import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportService as api } from '../../services/report.service';
import { http } from '../../services/http.service';
import { FileBarChart, Download, Calendar } from 'lucide-react';
import { useContext } from 'react';
import { ToastContext } from '../../contexts/toastContext';

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const rangeLabel = startDate && endDate ? `${startDate} - ${endDate}` : '—';

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await api.getRevenueReport(params.toString());
      setReport(res.data);
      addToast(t('common.success'), 'success');
    } catch (err) { addToast(err.message || t('common.error'), 'error'); }
    finally { setLoading(false); }
  }

  async function downloadFile(type) {
    try {
      const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
      if (!startDate || !endDate) {
        addToast(t('reports.messages.select_dates'), 'error');
        return;
      }

      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      params.set('lang', lang);

      const endpoint = type === 'pdf' ? `/reports/revenue/pdf?${params}` : `/reports/revenue/excel?${params}`;
      let token = http.getAccessToken();
      if (!token) {
        const refreshed = await http.tryRefresh();
        if (!refreshed) throw new Error(t('auth.session_expired'));
        token = http.getAccessToken();
      }

      const response = await fetch(`/api/v1${endpoint}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        const message = error.error?.message || error.message || t('common.error');
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-report-${startDate}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('reports.title')}</h1>
          <p className="page-subtitle">{t('reports.subtitle')}</p>
        </div>
      </div>

      <div className="card mb-md">
        <form onSubmit={handleGenerate} className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('reports.filter.start')}</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('reports.filter.end')}</label>
            <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-end' }}>
            {loading ? <span className="spinner"></span> : <FileBarChart size={18} />}
            {t('reports.filter.generate')}
          </button>
        </form>
      </div>

      {report && (
        <div>
          <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('reports.filter.start')}</span>
                <span className="badge badge-neutral">{rangeLabel}</span>
              </div>
              <div className="flex items-center gap-sm">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadFile('pdf')}>
                  <Download size={14} /> PDF
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadFile('excel')}>
                  <Download size={14} /> Excel
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-lg)' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}><FileBarChart size={24} /></div>
              <div>
                <div className="stat-value">{report.totalRevenue?.toFixed(2) || '0.00'} EGP</div>
                <div className="stat-label">{t('reports.stats.revenue')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)' }}><Calendar size={24} /></div>
              <div>
                <div className="stat-value">{report.tripCount || 0}</div>
                <div className="stat-label">{t('reports.stats.trips')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}><Download size={24} /></div>
              <div>
                <div className="stat-value">{report.totalExpenses?.toFixed(2) || '0.00'} EGP</div>
                <div className="stat-label">{t('reports.stats.expenses')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}><FileBarChart size={24} /></div>
              <div>
                <div className="stat-value">{report.netRevenue?.toFixed(2) || '0.00'} EGP</div>
                <div className="stat-label">{t('reports.stats.net')}</div>
              </div>
            </div>
          </div>

          {report.driverSummaries?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('reports.card.title')}</h3>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('reports.table.driver')}</th>
                      <th>{t('reports.table.trips')}</th>
                      <th>{t('reports.table.revenue')}</th>
                      <th>{t('reports.table.expenses')}</th>
                      <th>{t('reports.table.net')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.driverSummaries.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{d.driverName}</td>
                        <td>{d.tripCount}</td>
                        <td>{d.totalRevenue?.toFixed(2)} EGP</td>
                        <td>{d.totalExpenses?.toFixed(2)} EGP</td>
                        <td>{d.netRevenue?.toFixed(2)} EGP</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
