import { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { statsService as api } from '../../services/stats.service';
import { authService } from '../../services/auth.service';
import {
  Users, Car, Route, ClipboardCheck, Receipt,
  Clock, Info, TrendingUp, AlertTriangle, Shield
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ToastContext } from '../../contexts/toastContext';
import AnimatedCounter from '../../components/common/AnimatedCounter';

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [rescueRequests, setRescueRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stats loader
  const loadDashboardStats = useCallback(async () => {
    try {
      const res = await api.getSummaryStats();
      setStats(res.data);
    } catch (err) {
      console.error('Dashboard stats load error:', err);
      addToast(t('common.error'), 'error');
    }
  }, [addToast, t]);

  // Activity loader
  const loadRecentActivity = useCallback(async () => {
    try {
      const res = await api.getAuditLogs('limit=5');
      setRecentActivity(res.data.logs || []);
    } catch (err) {
      console.error('Recent activity load error:', err);
    }
  }, []);

  // Rescue Requests loader
  const loadRescueRequests = useCallback(async () => {
    try {
      const res = await authService.getPendingRescueRequests();
      setRescueRequests(res.data || []);
    } catch (err) {
      console.error('Rescue requests load error:', err);
    }
  }, []);

  const handleGenerateRescueCode = async (requestId) => {
    try {
      const res = await authService.generateRescueCode(requestId);
      addToast(`${t('auth.rescue_code')}: ${res.data.code}`, 'success', 15000);
      loadRescueRequests();
    } catch {
      addToast(t('common.error'), 'error');
    }
  };

  useEffect(() => {
    async function initDashboard() {
      setLoading(true);
      await Promise.allSettled([
        loadDashboardStats(),
        loadRecentActivity(),
        loadRescueRequests()
      ]);
      setLoading(false);
    }
    initDashboard();
  }, [loadDashboardStats, loadRecentActivity, loadRescueRequests]);

  useEffect(() => {
    const handleUpdate = () => {
      loadDashboardStats();
      loadRecentActivity();
      loadRescueRequests();
    };
    window.addEventListener('ws:notification', handleUpdate);
    window.addEventListener('ws:rescue_request', handleUpdate);
    return () => {
      window.removeEventListener('ws:notification', handleUpdate);
      window.removeEventListener('ws:rescue_request', handleUpdate);
    };
  }, [loadDashboardStats, loadRecentActivity, loadRescueRequests]);

  function formatActivityDate(d) {
    return new Date(d).toLocaleString(i18n.language, { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <p className="text-muted">{t('dashboard.loading')}</p>
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: t('dashboard.stats.drivers'), value: stats?.totalDrivers || 0, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
    { icon: Car, label: t('dashboard.stats.vehicles'), value: stats?.totalVehicles || 0, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
    { icon: Route, label: t('dashboard.stats.trips'), value: stats?.totalTrips || 0, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    { icon: ClipboardCheck, label: t('dashboard.stats.shifts'), value: stats?.activeShifts || 0, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
    { icon: TrendingUp, label: t('dashboard.stats.today_revenue'), value: `${stats?.todayRevenue?.toFixed(0) || 0} ${t('common.currency')}`, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    { icon: Receipt, label: t('dashboard.stats.today_expenses'), value: `${stats?.todayExpenses?.toFixed(0) || 0} ${t('common.currency')}`, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
    { icon: AlertTriangle, label: t('dashboard.stats.today_damages'), value: stats?.todayDamages || 0, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
    { icon: Receipt, label: t('dashboard.stats.today_pending_expenses'), value: stats?.pendingExpenses || 0, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-4 mt-lg">
        {statCards.map((card, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
              <card.icon size={24} />
            </div>
            <div>
              <div className="stat-label">{card.label}</div>
                            <div className="stat-value text-gradient">
                <AnimatedCounter 
                  value={card.value} 
                  suffix={card.label.toLowerCase().includes('revenue') || card.label.toLowerCase().includes('expense') ? ` ${t('common.currency')}` : ''} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {rescueRequests.length > 0 && (
        <div className="card mt-lg" style={{ borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div className="card-header">
            <h3 className="card-title flex items-center gap-xs" style={{ color: '#d97706' }}>
              <Shield size={18} />
              {t('auth.rescue_request_title')}
            </h3>
            <span className="badge badge-warning">{rescueRequests.length}</span>
          </div>
          <div className="flex flex-col gap-sm p-sm">
            {rescueRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-sm glass-card">
                <div>
                  <div className="font-semibold">{req.user?.name}</div>
                  <div className="text-xs text-muted">{req.user?.email}</div>
                  <div className="text-[10px] opacity-60 mt-xs">{formatActivityDate(req.createdAt)}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleGenerateRescueCode(req.id)}
                >
                  {t('auth.generate_rescue_code')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-1 mt-lg">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('dashboard.activity.title')}</h3>
            <Clock size={18} className="text-muted" />
          </div>
          {recentActivity.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <Info size={40} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
              <p className="text-sm text-muted">{t('dashboard.activity.empty')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              {recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center gap-md p-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex-shrink-0">
                    <span className="badge badge-neutral" style={{ background: 'var(--color-bg-tertiary)' }}>
                      {t(`actions.${activity.actionType?.split('.').pop()?.toLowerCase()}`, activity.actionType)}
                    </span>
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm font-medium">{activity.actor?.name || t('dashboard.activity.system')}</div>
                    <div className="text-xs text-muted flex items-center gap-xs">
                      <span className="opacity-70">{t(`entities.${activity.entityType?.toLowerCase()}`, activity.entityType)}</span>
                      <span className="font-mono bg-neutral-soft px-xs rounded text-[10px]">{activity.entityId?.slice(0, 8)}</span>
                      <span className="font-semibold text-primary">
                        {t(`actions.${activity.actionType?.split('.').pop()?.toLowerCase()}`, activity.actionType)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted flex-shrink-0">
                    {formatActivityDate(activity.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
