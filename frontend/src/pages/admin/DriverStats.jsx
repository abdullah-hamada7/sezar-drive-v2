import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { statsService } from '../../services/stats.service';
import { Calendar, Users, Car, DollarSign, Route } from 'lucide-react';

export default function DriverStatsPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('driver_stats.title')}</h1>
          <p className="page-subtitle">{t('driver_stats.subtitle')}</p>
        </div>
        <div className="flex gap-sm items-center">
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
            <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{totalFines.toFixed(2)} EGP</div>
            <div className="stat-label">{t('driver_stats.total_fines')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-info)', opacity: 0.15, color: 'var(--color-info)' }}>
            <Car size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalNet.toFixed(2)} EGP</div>
            <div className="stat-label">{t('driver_stats.net_revenue')}</div>
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
                  </tr>
                </thead>
                <tbody>
                  {stats.length === 0 ? (
                    <tr><td colSpan={5} className="empty-state">{t('driver_stats.empty')}</td></tr>
                  ) : stats.map(s => (
                    <tr key={s.driverId}>
                      <td style={{ fontWeight: 500 }}>{s.driverName}</td>
                      <td>
                        <span className="badge badge-success">{s.tripsCompleted}</span>
                      </td>
                      <td>
                        {s.tripRevenue != null ? `${Number(s.tripRevenue).toFixed(2)} EGP` : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                        {s.totalFines > 0 ? `${Number(s.totalFines).toFixed(2)} EGP` : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        {s.netRevenue != null ? `${Number(s.netRevenue).toFixed(2)} EGP` : '—'}
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
