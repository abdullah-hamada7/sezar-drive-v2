import { useMemo, useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { statsService } from '../../services/stats.service';
import { tripService } from '../../services/trip.service';
import { Calendar, Users, Car, DollarSign, Route, Wallet, Download } from 'lucide-react';
import PromptModal from '../../components/common/PromptModal';
import { ToastContext } from '../../contexts/toastContext';

export default function DriverStatsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showUncollectedOnly, setShowUncollectedOnly] = useState(false);
  const [cashExceptions, setCashExceptions] = useState(null);
  const [cashExceptionsLoading, setCashExceptionsLoading] = useState(false);
  const [cashExceptionsActionLoading, setCashExceptionsActionLoading] = useState(false);
  const [cashCollectPrompt, setCashCollectPrompt] = useState({ isOpen: false, tripId: null });

  const [cashDriverQuery, setCashDriverQuery] = useState('');
  const [cashMinAmount, setCashMinAmount] = useState('');
  const [cashMinAgeMinutes, setCashMinAgeMinutes] = useState('');
  const [cashSort, setCashSort] = useState('amount_desc');

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

  useEffect(() => {
    async function loadExceptions() {
      setCashExceptionsLoading(true);
      try {
        const res = await statsService.getCashExceptions(date);
        setCashExceptions(res.data || null);
      } catch (err) {
        console.error(err);
        const code = err?.errorCode || err?.code;
        addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
        setCashExceptions(null);
      } finally {
        setCashExceptionsLoading(false);
      }
    }
    loadExceptions();
  }, [date, addToast, t]);

  async function refreshCashExceptions() {
    setCashExceptionsLoading(true);
    try {
      const res = await statsService.getCashExceptions(date);
      setCashExceptions(res.data || null);
    } catch (err) {
      console.error(err);
      const code = err?.errorCode || err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
      setCashExceptions(null);
    } finally {
      setCashExceptionsLoading(false);
    }
  }

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

  function formatAge(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours <= 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }

  function ageMinutes(value) {
    if (!value) return 0;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  }

  function exportCashExceptionsCsv() {
    const data = filteredCashExceptionDrivers;
    const toCell = (value) => {
      const s = value == null ? '' : String(value);
      const escaped = s.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const header = [
      'Driver',
      'Driver ID',
      'Trip ID',
      'Shift ID',
      'Vehicle',
      'Completed at',
      'Age',
      'Amount',
      'Pickup',
      'Dropoff',
    ];

    const lines = [header.join(',')];
    for (const driver of data) {
      for (const trip of driver.trips || []) {
        lines.push([
          driver.driverName,
          driver.driverId,
          trip.id,
          trip.shiftId,
          trip.vehiclePlateNumber || '',
          trip.actualEndTime,
          formatAge(trip.actualEndTime),
          trip.price,
          trip.pickupLocation,
          trip.dropoffLocation,
        ].map(toCell).join(','));
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-exceptions-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportCashExceptionsPdf() {
    setCashExceptionsActionLoading(true);
    try {
      const res = await statsService.getCashExceptionsPdf(date);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-exceptions-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      const code = err?.errorCode || err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
    } finally {
      setCashExceptionsActionLoading(false);
    }
  }

  async function onConfirmCashCollected(note) {
    const tripId = cashCollectPrompt.tripId;
    if (!tripId) return;

    setCashExceptionsActionLoading(true);
    try {
      await tripService.markCashCollectedAdmin(tripId, note);
      await refreshCashExceptions();
      addToast(t('driver_stats.cash_exceptions_mark_collected_success'), 'success');
    } catch (err) {
      console.error(err);
      const code = err?.errorCode || err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
    } finally {
      setCashExceptionsActionLoading(false);
    }
  }

  const filteredCashExceptionDrivers = useMemo(() => {
    const drivers = Array.isArray(cashExceptions?.drivers) ? cashExceptions.drivers : [];
    const q = String(cashDriverQuery || '').trim().toLowerCase();
    const minAmount = Number(cashMinAmount);
    const minAge = Number(cashMinAgeMinutes);

    const normalized = drivers
      .map((d) => {
        const trips = Array.isArray(d.trips) ? d.trips : [];
        const filteredTrips = trips.filter((trip) => {
          if (q && !String(d.driverName || '').toLowerCase().includes(q) && !String(d.driverId || '').toLowerCase().includes(q)) {
            return false;
          }
          const amount = Number(trip.price) || 0;
          if (Number.isFinite(minAmount) && minAmount > 0 && amount < minAmount) return false;
          const age = ageMinutes(trip.actualEndTime);
          if (Number.isFinite(minAge) && minAge > 0 && age < minAge) return false;
          return true;
        });

        const uncollectedCashTotal = filteredTrips.reduce((sum, trip) => sum + (Number(trip.price) || 0), 0);
        return {
          ...d,
          trips: filteredTrips,
          uncollectedCashTripsCount: filteredTrips.length,
          uncollectedCashTotal,
        };
      })
      .filter((d) => d.uncollectedCashTripsCount > 0);

    const sorted = [...normalized].sort((a, b) => {
      if (cashSort === 'age_desc') {
        const aAge = Math.max(...(a.trips || []).map((t) => ageMinutes(t.actualEndTime)), 0);
        const bAge = Math.max(...(b.trips || []).map((t) => ageMinutes(t.actualEndTime)), 0);
        if (bAge !== aAge) return bAge - aAge;
      }

      if (cashSort === 'count_desc') {
        if (b.uncollectedCashTripsCount !== a.uncollectedCashTripsCount) return b.uncollectedCashTripsCount - a.uncollectedCashTripsCount;
      }

      // default: amount_desc
      if (b.uncollectedCashTotal !== a.uncollectedCashTotal) return b.uncollectedCashTotal - a.uncollectedCashTotal;
      return String(a.driverName || '').localeCompare(String(b.driverName || ''));
    });

    return sorted;
  }, [cashExceptions, cashDriverQuery, cashMinAmount, cashMinAgeMinutes, cashSort]);

  const cashExceptionsTotals = useMemo(() => {
    const drivers = filteredCashExceptionDrivers;
    const trips = drivers.reduce((sum, d) => sum + (d.uncollectedCashTripsCount || 0), 0);
    const total = drivers.reduce((sum, d) => sum + (Number(d.uncollectedCashTotal) || 0), 0);
    return { trips, total };
  }, [filteredCashExceptionDrivers]);

  const cashTopOffenders = useMemo(() => filteredCashExceptionDrivers.slice(0, 5), [filteredCashExceptionDrivers]);

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

      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card-header">
          <h3 className="card-title">{t('driver_stats.cash_exceptions_title')}</h3>
          <div className="flex gap-sm items-center">
            <span className="badge badge-danger">
              {cashExceptionsTotals.trips}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{formatMoney(cashExceptionsTotals.total)}</span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={exportCashExceptionsCsv}
              disabled={cashExceptionsLoading || cashExceptionsActionLoading || !(cashExceptionsTotals.trips > 0)}
            >
              <Download size={16} /> {t('driver_stats.export_cash_exceptions_csv')}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={exportCashExceptionsPdf}
              disabled={cashExceptionsLoading || cashExceptionsActionLoading || !(cashExceptionsTotals.trips > 0)}
            >
              <Download size={16} /> {t('driver_stats.export_cash_exceptions_pdf')}
            </button>
          </div>
        </div>

        {cashExceptionsLoading ? (
          <div className="loading-page"><div className="spinner"></div></div>
        ) : (cashExceptionsTotals.trips || 0) === 0 ? (
          <div className="empty-state" style={{ padding: '1.25rem' }}>{t('driver_stats.cash_exceptions_empty')}</div>
        ) : (
          <div className="table-container">
            <div style={{ padding: 'var(--space-md)' }}>
              <div className="grid grid-4 gap-md">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('driver_stats.cash_exceptions_filter_driver')}</label>
                  <input
                    className="form-input"
                    value={cashDriverQuery}
                    onChange={(e) => setCashDriverQuery(e.target.value)}
                    placeholder={t('driver_stats.cash_exceptions_filter_driver_ph')}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('driver_stats.cash_exceptions_filter_min_amount')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="1"
                    value={cashMinAmount}
                    onChange={(e) => setCashMinAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('driver_stats.cash_exceptions_filter_min_age')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="5"
                    value={cashMinAgeMinutes}
                    onChange={(e) => setCashMinAgeMinutes(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('driver_stats.cash_exceptions_sort')}</label>
                  <select className="form-input" value={cashSort} onChange={(e) => setCashSort(e.target.value)}>
                    <option value="amount_desc">{t('driver_stats.cash_exceptions_sort_amount')}</option>
                    <option value="count_desc">{t('driver_stats.cash_exceptions_sort_count')}</option>
                    <option value="age_desc">{t('driver_stats.cash_exceptions_sort_age')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 var(--space-md) var(--space-md)' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 'var(--space-sm)' }}>
                {t('driver_stats.cash_exceptions_showing', { drivers: filteredCashExceptionDrivers.length, trips: cashExceptionsTotals.trips })}
              </div>

              {cashTopOffenders.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
                    <div style={{ fontWeight: 700 }}>{t('driver_stats.cash_exceptions_top_offenders')}</div>
                    <div className="text-xs text-muted">{t('driver_stats.cash_exceptions_top_offenders_hint')}</div>
                  </div>
                  <div className="table-responsive" style={{ marginTop: 'var(--space-sm)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>{t('driver_stats.driver')}</th>
                          <th>{t('driver_stats.uncollected_cash_trips')}</th>
                          <th>{t('driver_stats.uncollected_cash')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashTopOffenders.map((d) => (
                          <tr key={`${d.driverId}-top`}>
                            <td style={{ fontWeight: 600 }}>{d.driverName}</td>
                            <td><span className="badge badge-danger">{d.uncollectedCashTripsCount}</span></td>
                            <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{formatMoney(d.uncollectedCashTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>{t('driver_stats.driver')}</th>
                    <th>{t('driver_stats.uncollected_cash_trips')}</th>
                    <th>{t('driver_stats.uncollected_cash')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashExceptionDrivers.map((d) => (
                    <tr key={d.driverId}>
                      <td style={{ fontWeight: 600 }}>{d.driverName}</td>
                      <td><span className="badge badge-danger">{d.uncollectedCashTripsCount}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{formatMoney(d.uncollectedCashTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '0 var(--space-md) var(--space-md)' }}>
              {filteredCashExceptionDrivers.map((d) => (
                <details key={`${d.driverId}-details`} style={{ marginTop: 'var(--space-sm)' }}>
                  <summary className="text-sm" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {d.driverName} - {d.uncollectedCashTripsCount} - {formatMoney(d.uncollectedCashTotal)}
                  </summary>
                  <div className="table-responsive" style={{ marginTop: 'var(--space-sm)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>{t('driver_stats.cash_exceptions_trip_id')}</th>
                          <th>{t('driver_stats.cash_exceptions_completed_at')}</th>
                          <th>{t('driver_stats.cash_exceptions_age')}</th>
                          <th>{t('driver_stats.cash_exceptions_amount')}</th>
                          <th>{t('driver_stats.cash_exceptions_location')}</th>
                          <th>{t('driver_stats.cash_exceptions_actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d.trips || []).map((trip) => (
                          <tr key={trip.id}>
                            <td className="font-mono">{String(trip.id).slice(0, 8)}</td>
                            <td>{trip.actualEndTime ? new Date(trip.actualEndTime).toLocaleString(i18n.language) : '—'}</td>
                            <td>{formatAge(trip.actualEndTime)}</td>
                            <td style={{ fontWeight: 600 }}>{formatMoney(trip.price)}</td>
                            <td className="text-sm">
                              {trip.pickupLocation}{' -> '}{trip.dropoffLocation}
                              {trip.vehiclePlateNumber ? ` | ${trip.vehiclePlateNumber}` : ''}
                            </td>
                            <td>
                              <div className="flex gap-sm items-center">
                                <Link className="btn btn-secondary btn-sm" to={`/admin/trips?tripId=${encodeURIComponent(trip.id)}`}>
                                  {t('driver_stats.cash_exceptions_view_trip')}
                                </Link>
                                <button
                                  className="btn btn-primary btn-sm"
                                  type="button"
                                  disabled={cashExceptionsActionLoading}
                                  onClick={() => setCashCollectPrompt({ isOpen: true, tripId: trip.id })}
                                >
                                  {t('driver_stats.cash_exceptions_mark_collected')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

      <PromptModal
        isOpen={cashCollectPrompt.isOpen}
        onClose={() => setCashCollectPrompt({ isOpen: false, tripId: null })}
        onConfirm={onConfirmCashCollected}
        title={t('driver_stats.cash_exceptions_mark_collected_title')}
        message={t('driver_stats.cash_exceptions_mark_collected_message')}
        placeholder={t('trip.payment.cash_collect_note_placeholder')}
        confirmText={t('driver_stats.cash_exceptions_mark_collected')}
        maxLength={250}
        required={false}
      />
    </div>
  );
}
