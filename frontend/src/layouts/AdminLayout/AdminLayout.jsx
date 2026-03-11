import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ThemeContext } from '../../contexts/theme';
import { useLanguage } from '../../hooks/useLanguage';
import {
  LayoutDashboard, Users, Car, Route, ClipboardCheck,
  Receipt, AlertTriangle, MapPin, FileBarChart, Shield,
  Menu, X, LogOut, ChevronRight, Bell, Info, UserCheck,
  Sun, Moon, SteeringWheel
} from 'lucide-react';
import './AdminLayout.css';
import { statsService } from '../../services/stats.service';
import { buildTrackingWsUrl } from '../../utils/trackingWs';
import { playNotificationSound } from '../../utils/notificationSound';
import { evaluateRealtimeEvent, resetRealtimeStream } from '../../utils/realtimeGuard';
import { http } from '../../services/http.service';

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
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const displayedCounts = useMemo(() => {
    return {
      ...pendingCounts,
      expenses: location.pathname === '/admin/expenses' ? 0 : pendingCounts.expenses,
      damage: location.pathname === '/admin/damage' ? 0 : pendingCounts.damage,
    };
  }, [pendingCounts, location.pathname]);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [notif, ...prev].slice(0, 5));
    playNotificationSound();

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
    ...(user?.adminRole === 'SUPER_ADMIN' ? [{ to: '/admin/admins', icon: UserCheck, label: t('nav.admins') }] : []),
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

    async function connectWS() {
      let token = http.getAccessToken();
      if (!token) {
        const refreshed = await http.tryRefresh();
        if (!refreshed) return;
        token = http.getAccessToken();
      }
      if (!token) return;

      const ws = new WebSocket(buildTrackingWsUrl(token));
      wsRef.current = ws;

      ws.onopen = () => {
        fetchCounts();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data?.type === 'notification' ? data?.payload?.type || 'notification' : data?.type;
          const guard = evaluateRealtimeEvent('admin', eventType, data);

          if (guard.gapDetected && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ws:resync-required', {
              detail: { stream: 'admin', eventType, sequence: guard.sequence, expected: guard.expected },
            }));
            window.dispatchEvent(new CustomEvent('ws:update', {
              detail: { type: 'resync_required', stream: 'admin' },
            }));
          }

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

      ws.onclose = () => {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        reconnectTimerRef.current = setTimeout(connectWS, 5000);
      };
    }

    const handleOnline = () => {
      resetRealtimeStream('admin');
      fetchCounts();
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWS();
      }
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchCounts();
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWS();
      }
    };

    connectWS();
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
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
            <SteeringWheel size={20} />
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
              <SteeringWheel size={20} />
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
          <button
            type="button"
            className="sidebar-user"
            title={t('nav.profile')}
            onClick={() => {
              navigate('/admin/profile');
              if (window.innerWidth <= 1024) setSidebarOpen(false);
            }}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'inherit',
              cursor: 'pointer',
              color: 'inherit'
            }}
          >
            <div className="user-avatar">
              {(user?.name?.charAt(0) || user?.email?.charAt(0) || '').toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            )}
          </button>
          <div className="footer-actions flex gap-sm">
            <button
              className="btn-icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('common.theme.light_mode') : t('common.theme.dark_mode')}
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
