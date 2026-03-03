import { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../contexts/ShiftContext';
import { authService } from '../../services/auth.service';
import { http } from '../../services/http.service';
import { ClipboardCheck, User } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import { ThemeContext } from '../../contexts/theme';

import DriverDetailsModal from '../../components/driver/DriverDetailsModal';
import DailyEarningsChart from '../../components/driver/DailyEarningsChart';
import RecentActivityList from '../../components/driver/RecentActivityList';

export default function DriverHome() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const { addToast } = useContext(ToastContext);
  const { theme } = useContext(ThemeContext);
  const { activeShift, loading: shiftLoading } = useShift();
  const [showDetails, setShowDetails] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await authService.getMe();
      if (res.data?.user) {
        updateUser(res.data.user);
        if (res.data.accessToken) {
          http.setTokens(res.data.accessToken, undefined);
        }
        addToast(t('driver_home.status_refreshed'), 'success');
      }
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    }
  }, [t, updateUser, addToast]);

  useEffect(() => {
    const handleIdentityUpdate = (e) => {
      const { status, reason } = e.detail;
      if (status === 'approved') {
        addToast(t('driver_home.identity_approved'), 'success');
      } else {
        addToast(`${t('driver_home.identity_rejected')}: ${reason || ''}`, 'error');
      }
      refreshStatus();
    };

    window.addEventListener('ws:identity_update', handleIdentityUpdate);
    window.addEventListener('ws:trip_assigned', refreshStatus);
    window.addEventListener('ws:trip_cancelled', refreshStatus);
    window.addEventListener('ws:trip_completed', refreshStatus);

    return () => {
      window.removeEventListener('ws:identity_update', handleIdentityUpdate);
      window.removeEventListener('ws:trip_assigned', refreshStatus);
      window.removeEventListener('ws:trip_cancelled', refreshStatus);
      window.removeEventListener('ws:trip_completed', refreshStatus);
    };
  }, [t, addToast, refreshStatus]);


  if (shiftLoading) return <div className="loading-page"><div className="spinner"></div></div>;

  const isShiftActive = activeShift?.status === 'Active';
  const isShiftPending = activeShift?.status === 'PendingVerification';
  const isLight = theme === 'light';

  const pageStyle = isLight
    ? {
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-lg)'
      }
    : undefined;

  const profileCardStyle = isLight
    ? {
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)'
      }
    : undefined;

  const statusCardStyle = (accent, bg) => (
    isLight
      ? {
          borderColor: accent,
          background: bg,
          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)'
        }
      : {
          borderColor: accent,
          background: bg
        }
  );

  return (
    <div style={pageStyle}>

      {/* Profile & Avatar */}
      <div className="card glass-card mb-md flex items-center justify-between" style={profileCardStyle}>
        <div className="flex items-center gap-md">
          <div className="glow-effect" style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: isLight ? '#f1f5f9' : 'var(--color-bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${isLight ? '#0f172a' : 'var(--color-primary)'}`, boxShadow: isLight ? '0 6px 16px rgba(15, 23, 42, 0.12)' : 'var(--shadow-glow)' }}>
            {user?.avatarUrl || user?.profilePhotoUrl
              ? <img src={user.avatarUrl || user.profilePhotoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <User size={32} className="text-primary" />}
          </div>
          <div>
            <div className={isLight ? 'text-xl font-bold leading-tight' : 'text-xl font-bold text-gradient leading-tight'} style={isLight ? { color: '#0f172a' } : undefined}>{user?.name}</div>
            <div className="text-sm text-muted opacity-80" style={isLight ? { color: '#475569' } : undefined}>{user?.email}</div>
            <div className="mt-xs">
              <span className={`badge ${user?.identityVerified ? 'badge-success' : 'badge-warning'} text-[10px] px-sm py-0`}>
                {user?.identityVerified ? t('common.status.verified') : t('common.status.pending')}
              </span>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn-icon" onClick={() => setShowDetails(true)} title={t('drivers.modal.details_title')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
          </button>
        </div>
      </div>

      <DriverDetailsModal
        driver={user}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
      />

      {/* Shift Status */}
      {isShiftActive && (
        <div className="card mb-md" style={statusCardStyle('var(--color-success)', 'var(--color-success-bg)')}>
          <div className="flex items-center gap-md">
            <ClipboardCheck size={24} style={{ color: 'var(--color-success)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{t('shift.active')}</div>
              <div className="text-sm text-muted">{t('shift.vehicle')}: {activeShift.vehicle?.plateNumber || '—'}</div>
            </div>
          </div>
        </div>
      )}
      {isShiftPending && (
        <div className="card mb-md" style={statusCardStyle('var(--color-warning)', 'var(--color-warning-bg)')}>
          <div className="flex items-center gap-md">
            <ClipboardCheck size={24} style={{ color: 'var(--color-warning)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{t('shift.pending')}</div>
              <div className="text-sm text-muted">{t('shift.awaiting_verification')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Grid for Charts & Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <DailyEarningsChart />
      </div>

      <div className="mt-md">
        <RecentActivityList />
      </div>
    </div>
  );
}
