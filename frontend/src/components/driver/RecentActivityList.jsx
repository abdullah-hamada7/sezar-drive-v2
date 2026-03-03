import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { statsService } from '../../services/stats.service';
import { ThemeContext } from '../../contexts/theme';

export default function RecentActivityList() {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadActivity() {
      try {
        setLoading(true);
        setError(null);
        const res = await statsService.getDriverActivity();
        const result = res.data || res;
        setData(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error('Failed to load activity:', err);
        setError(t('errors.fetch_failed') || 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    }
    loadActivity();
  }, [t]);

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';

    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return t('common.now') || 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  const isLight = theme === 'light';
  const cardStyle = isLight
    ? {
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)'
      }
    : undefined;
  const headerStyle = isLight ? { color: '#0f172a' } : { color: '#f8fafc' };
  const mutedStyle = isLight ? { color: '#64748b' } : undefined;
  const rowStyle = isLight
    ? { background: '#f8fafc', border: '1px solid #e2e8f0' }
    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' };
  const amountColor = (value) => {
    if ((Number(value) || 0) < 0) return '#f43f5e';
    return isLight ? '#0ea5e9' : '#00F5FF';
  };

  if (loading) return (
    <div className="card h-40 flex flex-col items-center justify-center gap-sm">
      <div className="spinner"></div>
      <div className="text-muted text-sm">{t('common.loading')}</div>
    </div>
  );

  return (
    <div className="card" style={cardStyle}>
      <div className="flex items-center justify-between mb-sm">
        <h3 className="text-lg font-bold" style={headerStyle}>{t('driver_home.recent_activity')}</h3>
        <span className="text-xs" style={mutedStyle}>{t('common.last_updated') || 'Latest updates'}</span>
      </div>
      <div className="flex flex-col gap-sm">
        {error ? (
          <div className="text-danger text-center py-md bg-danger-bg rounded border border-danger">
            <div className="text-sm font-bold">{error}</div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-muted text-center py-md rounded border border-dashed" style={isLight ? { background: '#f8fafc', borderColor: '#e2e8f0' } : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}>
            {t('common.no_data') || 'No recent activity'}
          </div>
        ) : (
          data.map((item, idx) => (
            <div key={item.id || idx} className="p-sm rounded flex justify-between items-center transition-all" style={rowStyle}>
              <div>
                <div className="font-bold text-sm" style={{ color: item.status === 'CANCELLED' ? '#f43f5e' : (isLight ? '#0f172a' : '#f8fafc'), display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {(item.type || 'activity').toUpperCase()}
                  <span className="opacity-40 text-[10px]">•</span>
                  <span className="opacity-80 text-[11px]">{item.status || '...'}</span>
                </div>
                <div className="text-xs truncate max-w-[180px]" style={mutedStyle}>{item.title || '—'}</div>
              </div>
              <div className="text-right">
                <div style={{ color: amountColor(item.amount), fontWeight: 700, letterSpacing: '0.01em' }}>
                  {item.amount !== null && item.amount !== undefined ? Number(item.amount).toFixed(2) : '—'}
                </div>
                <div className="text-xs font-mono" style={mutedStyle}>{formatTime(item.timestamp)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
