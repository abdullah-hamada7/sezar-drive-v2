import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { statsService } from '../../services/stats.service';
import { Calendar, Users, Car, DollarSign, Route, Wallet, Download } from 'lucide-react';

export default function DriverStatsPage() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showUncollectedOnly, setShowUncollectedOnly] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await statsService.getDailyReport(date);
        setStats(res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [date]);

  const totalTrips = stats.reduce((sum, s) => sum + (s.tripsCompleted || 0), 0);
  const totalFines = stats.reduce((sum, s) => sum + (s.totalFines || 0), 0);
  const totalNet = stats.reduce((sum, s) => sum + (s.netRevenue || 0), 0);
  const totalCashToCollect = stats.reduce((sum, s) => sum + (s.cashToCollectTotal || 0), 0);
  const totalCashCollected = stats.reduce((sum, s) => sum + (s.cashCollectedTotal || 0), 0);
  const totalUncollectedCash = stats.reduce((sum, s) => sum + (s.uncollectedCashTotal || 0), 0);
  const totalUncollectedTrips = stats.reduce((sum, s) => sum + (s.uncollectedCashTripsCount || 0), 0);

  function formatMoney(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const formatted = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    return `${formatted} ${t('common.currency')}`;
  }

  const rows = useMemo(() => {
    const sorted = [...stats].sort((a, b) => {
      const au = Number(a?.uncollectedCashTotal) || 0;
      const bu = Number(b?.uncollectedCashTotal) || 0;
      if (bu !== au) return bu - au;
      const ac = Number(a?.uncollectedCashTripsCount) || 0;
      const bc = Number(b?.uncollectedCashTripsCount) || 0;
      if (bc !== ac) return bc - ac;
      return String(a?.driverName || '').localeCompare(String(b?.driverName || ''));
    });
    return showUncollectedOnly ? sorted.filter((r) => (Number(r?.uncollectedCashTotal) || 0) > 0) : sorted;
  }, [stats, showUncollectedOnly]);

  function exportCsv() {
    const toCell = (value) => {
      const s = value == null ? '' : String(value);
      const escaped = s.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const header = [
      'Driver',
      'Trips',
      'Trip revenue',
      'Total fines',
      'Net revenue',
      'Cash trips',
      'Cash to collect',
      'Cash collected',
      'Uncollected cash',
      'Uncollected cash trips',
    ];

    const lines = [header.join(',')];
    for (const s of rows) {
      lines.push([
        s.driverName,
        s.tripsCompleted,
        s.tripRevenue,
        s.totalFines,
        s.netRevenue,
        s.cashTripsCount,
        s.cashToCollectTotal,
        s.cashCollectedTotal,
        s.uncollectedCashTotal,
        s.uncollectedCashTripsCount,
      ].map(toCell).join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-daily-stats-${date}${showUncollectedOnly ? '-uncollected' : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('driver_stats.title')}</h1>
          <p className="page-subtitle">{t('driver_stats.subtitle')}</p>
        </div>
        <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <label className="flex items-center gap-sm" style={{ userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showUncollectedOnly}
              onChange={(e) => setShowUncollectedOnly(e.target.checked)}
            />
            <span className="text-sm">{t('driver_stats.show_uncollected_only')}</span>
          </label>
          <button className="btn btn-secondary" type="button" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download size={16} /> {t('driver_stats.export_csv')}
          </button>
          <Calendar size={18} />
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      <div className="grid grid-4 gap-md mb-lg">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-primary)', opacity: 0.15, color: 'var(--color-primary)' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.length}</div>
            <div className="stat-label">{t('driver_stats.active_drivers')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-success)', opacity: 0.15, color: 'var(--color-success)' }}>
            <Route size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalTrips}</div>
            <div className="stat-label">{t('driver_stats.total_trips')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-danger)', opacity: 0.15, color: 'var(--color-danger)' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{formatMoney(totalFines)}</div>
            <div className="stat-label">{t('driver_stats.total_fines')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-info)', opacity: 0.15, color: 'var(--color-info)' }}>
            <Car size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatMoney(totalNet)}</div>
            <div className="stat-label">{t('driver_stats.net_revenue')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-4 gap-md mb-lg">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-warning)', opacity: 0.15, color: 'var(--color-warning)' }}>
            <Wallet size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatMoney(totalCashToCollect)}</div>
            <div className="stat-label">{t('driver_stats.cash_to_collect_total')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-success)', opacity: 0.15, color: 'var(--color-success)' }}>
            <Wallet size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{formatMoney(totalCashCollected)}</div>
            <div className="stat-label">{t('driver_stats.cash_collected_total')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-danger)', opacity: 0.15, color: 'var(--color-danger)' }}>
            <Wallet size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: totalUncollectedCash > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>{formatMoney(totalUncollectedCash)}</div>
            <div className="stat-label">{t('driver_stats.uncollected_cash_total')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-danger)', opacity: 0.15, color: 'var(--color-danger)' }}>
            <Route size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalUncollectedTrips}</div>
            <div className="stat-label">{t('driver_stats.uncollected_cash_trips')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('driver_stats.table_title')}</h3>
        </div>
        {loading ? (
          <div className="loading-page"><div className="spinner"></div></div>
        ) : (
          <div className="table-container">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>{t('driver_stats.driver')}</th>
                    <th>{t('driver_stats.trips_completed')}</th>
                    <th>{t('driver_stats.trip_revenue')}</th>
                    <th>{t('driver_stats.total_fines')}</th>
                    <th>{t('driver_stats.net_revenue')}</th>
                    <th>{t('driver_stats.cash_trips')}</th>
                    <th>{t('driver_stats.cash_to_collect')}</th>
                    <th>{t('driver_stats.cash_collected')}</th>
                    <th>{t('driver_stats.uncollected_cash')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9} className="empty-state">{t('driver_stats.empty')}</td></tr>
                  ) : rows.map(s => (
                    <tr key={s.driverId}>
                      <td style={{ fontWeight: 500 }}>{s.driverName}</td>
                      <td>
                        <span className="badge badge-success">{s.tripsCompleted}</span>
                      </td>
                      <td>
                        {s.tripRevenue != null ? formatMoney(s.tripRevenue) : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                        {s.totalFines > 0 ? formatMoney(s.totalFines) : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        {s.netRevenue != null ? formatMoney(s.netRevenue) : '—'}
                      </td>
                      <td>
                        <span className="badge badge-info">{s.cashTripsCount || 0}</span>
                      </td>
                      <td>
                        {s.cashToCollectTotal > 0 ? formatMoney(s.cashToCollectTotal) : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        {s.cashCollectedTotal > 0 ? formatMoney(s.cashCollectedTotal) : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: s.uncollectedCashTotal > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        {s.uncollectedCashTotal > 0 ? formatMoney(s.uncollectedCashTotal) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
