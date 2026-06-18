import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useEffect, useCallback, useState, useContext } from 'react';
import { ThemeContext } from '../../contexts/theme';
import {
  ClipboardCheck, Route, Receipt, AlertTriangle,
  Camera, LogOut, Home, Languages, Sun, Moon, AlertCircle
} from 'lucide-react';
import BrandIcon from '../../components/BrandIcon';
import { useLanguage } from '../../hooks/useLanguage';
import { usePushPermission } from '../../hooks/usePushPermission';
import ConfirmModal from '../../components/common/ConfirmModal';
import { tripService } from '../../services/trip.service';
import './DriverLayout.css';

export default function DriverLayout() {
  const { language, toggleLanguage, t } = useLanguage();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { isSyncing, pendingCount } = useOfflineSync();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [assignedCount, setAssignedCount] = useState(0);

  usePushPermission();
  useDriverTracking();

  const fetchAssignedCount = useCallback(async () => {
    try {
      const res = await tripService.getTrips('status=ASSIGNED');
      const count = res?.data?.trips?.length || 0;
      setAssignedCount(count);
    } catch (err) {
      console.error('Error fetching assigned trips count:', err);
    }
  }, []);

  useEffect(() => {
    fetchAssignedCount();

    const handleUpdate = () => {
      fetchAssignedCount();
    };

    window.addEventListener('ws:trip_assigned', handleUpdate);
    window.addEventListener('ws:trip_accepted', handleUpdate);
    window.addEventListener('ws:trip_cancelled', handleUpdate);
    window.addEventListener('ws:trip_completed', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    window.addEventListener('online', handleUpdate);

    const interval = setInterval(handleUpdate, 15000);

    return () => {
      window.removeEventListener('ws:trip_assigned', handleUpdate);
      window.removeEventListener('ws:trip_accepted', handleUpdate);
      window.removeEventListener('ws:trip_cancelled', handleUpdate);
      window.removeEventListener('ws:trip_completed', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
      window.removeEventListener('online', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchAssignedCount]);

  const syncChipLabel = isSyncing
    ? t('common.offline.syncing_short')
    : t('common.offline.pending_short', { count: pendingCount });

  const navItems = [
    { to: '/driver', icon: Home, label: t('nav_driver.home'), end: true, badge: assignedCount },
    { to: '/driver/shift', icon: ClipboardCheck, label: t('nav_driver.shift'), badge: assignedCount },
    { to: '/driver/trips', icon: Route, label: t('nav_driver.trips'), badge: assignedCount },
    { to: '/driver/inspection', icon: Camera, label: t('nav_driver.inspection'), badge: assignedCount },
    { to: '/driver/expenses', icon: Receipt, label: t('nav_driver.expenses'), badge: assignedCount },
    { to: '/driver/damage', icon: AlertTriangle, label: t('nav_driver.damage'), badge: assignedCount },
    { to: '/driver/violations', icon: AlertCircle, label: t('nav_driver.violations'), badge: assignedCount },
  ];

  return (
    <div className="driver-layout">
      <header className="driver-header">
        <div className="sidebar-brand">
          <BrandIcon variant="full" height={28} />
        </div>
        <div className="driver-header-right">
          {pendingCount > 0 && (
            <NavLink
              to="/driver/sync"
              className={`driver-sync-chip ${isSyncing ? 'driver-sync-chip-syncing' : 'driver-sync-chip-pending'}`}
              title={syncChipLabel}
            >
              {syncChipLabel}
            </NavLink>
          )}
          <button 
            className="btn-icon" 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            className="btn-icon" 
            onClick={toggleLanguage}
            title={language === 'ar' ? 'English' : 'العربية'}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{language === 'ar' ? 'EN' : 'AR'}</span>
          </button>
          <button
            className="btn-icon"
            onClick={() => setLogoutConfirmOpen(true)}
            title={t('nav.logout')}
          >
            <LogOut size={18} className="mirror-rtl" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="driver-main">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="driver-bottom-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `driver-nav-item ${isActive ? 'active' : ''}`}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <item.icon size={20} />
              {item.badge > 0 && (
                <span className="driver-nav-badge">
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <ConfirmModal
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={logout}
        title={t('nav.logout')}
        message={t('common.logout_confirm')}
        confirmText={t('nav.logout')}
        variant="danger"
      />
    </div>
  );
}
