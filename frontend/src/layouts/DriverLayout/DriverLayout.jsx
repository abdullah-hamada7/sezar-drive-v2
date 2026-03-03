import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useContext } from 'react';
import { ThemeContext } from '../../contexts/theme';
import {
  Car, ClipboardCheck, Route, Receipt, AlertTriangle,
  Camera, LogOut, Home, Languages, Sun, Moon
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import './DriverLayout.css';

export default function DriverLayout() {
  const { language, toggleLanguage, t } = useLanguage();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  useDriverTracking();

  const navItems = [
    { to: '/driver', icon: Home, label: t('nav_driver.home'), end: true },
    { to: '/driver/shift', icon: ClipboardCheck, label: t('nav_driver.shift') },
    { to: '/driver/trips', icon: Route, label: t('nav_driver.trips') },
    { to: '/driver/inspection', icon: Camera, label: t('nav_driver.inspection') },
    { to: '/driver/expenses', icon: Receipt, label: t('nav_driver.expenses') },
    { to: '/driver/damage', icon: AlertTriangle, label: t('nav_driver.damage') },
  ];

  return (
    <div className="driver-layout">
      <header className="driver-header">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Car size={20} />
          </div>
          <span className="brand-text">{t('common.brand')}</span>
        </div>
        <div className="driver-header-right">
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
          <button className="btn-icon" onClick={logout} title={t('nav.logout')}><LogOut size={18} className="mirror-rtl" /></button>
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
    </div>
  );
}
