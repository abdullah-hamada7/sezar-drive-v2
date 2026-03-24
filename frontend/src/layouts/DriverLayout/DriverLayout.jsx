import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useContext, useState } from 'react';
import { ThemeContext } from '../../contexts/theme';
import {
  ClipboardCheck, Route, Receipt, AlertTriangle,
  Camera, LogOut, Home, Languages, Sun, Moon, AlertCircle
} from 'lucide-react';
import BrandIcon from '../../components/BrandIcon';
import { useLanguage } from '../../hooks/useLanguage';
import { usePushPermission } from '../../hooks/usePushPermission';
import ConfirmModal from '../../components/common/ConfirmModal';
import './DriverLayout.css';

export default function DriverLayout() {
  const { language, toggleLanguage, t } = useLanguage();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { isSyncing, pendingCount } = useOfflineSync();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  usePushPermission();
  useDriverTracking();
  const syncChipLabel = isSyncing
    ? t('common.offline.syncing_short')
    : t('common.offline.pending_short', { count: pendingCount });

  const navItems = [
    { to: '/driver', icon: Home, label: t('nav_driver.home'), end: true },
    { to: '/driver/shift', icon: ClipboardCheck, label: t('nav_driver.shift') },
    { to: '/driver/trips', icon: Route, label: t('nav_driver.trips') },
    { to: '/driver/inspection', icon: Camera, label: t('nav_driver.inspection') },
    { to: '/driver/expenses', icon: Receipt, label: t('nav_driver.expenses') },
    { to: '/driver/damage', icon: AlertTriangle, label: t('nav_driver.damage') },
    { to: '/driver/violations', icon: AlertCircle, label: t('nav_driver.violations') },
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
            <item.icon size={20} />
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
