import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ThemeContext } from '../../contexts/theme';
import { useLanguage } from '../../hooks/useLanguage';
import {
  LayoutDashboard, Users, Car, Route, ClipboardCheck,
  Receipt, AlertTriangle, MapPin, FileBarChart, Shield,
  Menu, X, LogOut, ChevronRight, Bell, Info, UserCheck,
  Sun, Moon
} from 'lucide-react';
import './AdminLayout.css';
import { statsService } from '../../services/stats.service';
import { buildTrackingWsUrl } from '../../utils/trackingWs';

export default function AdminLayout() {
  const { language, toggleLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [notifications, setNotifications] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({
    verification: 0,
    expenses: 0,
    damage: 0
  });
  const { user, logout } = useAuth();
  const location = useLocation();
  const wsRef = useRef(null);

  const displayedCounts = useMemo(() => {
    return {
      ...pendingCounts,
      expenses: location.pathname === '/admin/expenses' ? 0 : pendingCounts.expenses,
      damage: location.pathname === '/admin/damage' ? 0 : pendingCounts.damage,
    };
  }, [pendingCounts, location.pathname]);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [notif, ...prev].slice(0, 5));

    // Update local pending counts based on notification type
    // Only increment if not currently on that page
    if (notif.type === 'expense_pending' && location.pathname !== '/admin/expenses') {
      setPendingCounts(prev => ({ ...prev, expenses: prev.expenses + 1 }));
    } else if (notif.type === 'damage_reported' && location.pathname !== '/admin/damage') {
      setPendingCounts(prev => ({ ...prev, damage: prev.damage + 1 }));
    }

    // Auto-remove after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    }, 8000);
  }, [location.pathname]);

  const translatedNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: t('nav.dashboard'), end: true },
    ...(user?.adminRole === 'SUPER_ADMIN' ? [{ to: '/admin/admins', icon: UserCheck, label: t('nav.admins') || 'Admins' }] : []),
    { to: '/admin/drivers', icon: Users, label: t('nav.drivers') },
    { to: '/admin/vehicles', icon: Car, label: t('nav.vehicles') },
    { to: '/admin/shifts', icon: ClipboardCheck, label: t('nav.shifts') },
    { to: '/admin/trips', icon: Route, label: t('nav.trips') },
    { to: '/admin/expenses', icon: Receipt, label: t('nav.expenses'), countKey: 'expenses' },
    { to: '/admin/damage', icon: AlertTriangle, label: t('nav.damage_reports'), countKey: 'damage' },
    { to: '/admin/tracking', icon: MapPin, label: t('nav.tracking') },
    { to: '/admin/reports', icon: FileBarChart, label: t('nav.reports') },
    { to: '/admin/audit', icon: Shield, label: t('nav.audit_logs') },
  ];

  useEffect(() => {
    // Initial counts fetch
    async function fetchCounts() {
      try {
        const res = await statsService.getSummaryStats();
        setPendingCounts({
          expenses: res.data.pendingExpenses || 0,
          damage: res.data.pendingDamages || 0
        });
      } catch (err) { console.error('Error fetching summary stats:', err); }
    }
    fetchCounts();

    function connectWS() {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const ws = new WebSocket(buildTrackingWsUrl(token));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            const payload = data.payload;
            addNotification(payload);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ws:notification', { detail: payload }));
              if (payload?.type) {
                window.dispatchEvent(new CustomEvent(`ws:${payload.type}`, { detail: payload }));
              }
            }
          } else if (data.type && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(`ws:${data.type}`, { detail: data }));
          }
        } catch (err) { console.error('WS Error:', err); }
      };

      ws.onclose = () => setTimeout(connectWS, 5000);
    }

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [addNotification]);

  return (
    <div className="admin-layout">
      {/* Notifications Overlay */}
      <div className="notifications-container">
        {notifications.map(n => (
          <div key={n.id} className="notification-toast">
            <div className="notification-icon">
              {n.type.includes('damage') ? <AlertTriangle size={18} color="#ef4444" /> : <Info size={18} color="#3b82f6" />}
            </div>
            <div className="notification-content">
              <div className="notification-title">{n.title}</div>
              <div className="notification-message">{n.message}</div>
            </div>
            <button className="btn-icon" onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <header className="mobile-header">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Car size={20} />
          </div>
          <span className="brand-text">{t('common.brand')}</span>
        </div>
        <button className="btn-icon" onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <Car size={20} />
            </div>
            <span className="brand-text">{t('common.brand')}</span>
          </div>
          <button className="btn-icon sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {translatedNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
              title={item.label}
              onClick={() => {
                // Auto-close on mobile
                if (window.innerWidth <= 1024) {
                  setSidebarOpen(false);
                }
              }}
            >
              <div className="nav-icon-wrapper">
                <item.icon size={20} />
                {item.countKey && displayedCounts[item.countKey] > 0 && (
                  <span className="nav-badge">{displayedCounts[item.countKey]}</span>
                )}
              </div>
              {sidebarOpen && <span>{item.label}</span>}
              {sidebarOpen && <ChevronRight size={14} className="nav-arrow mirror-rtl" />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.name?.charAt(0) || 'A'}
            </div>
            {sidebarOpen && (
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            )}
          </div>
          <div className="footer-actions flex gap-sm">
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
            <button className="btn-icon" onClick={logout} title={t('nav.logout')}>
              <LogOut size={18} className="mirror-rtl" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
