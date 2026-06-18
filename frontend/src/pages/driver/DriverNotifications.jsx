import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, CheckCheck, Route, AlertTriangle } from 'lucide-react';
import { notificationService } from '../../services/notification.service';
import { useLanguage } from '../../hooks/useLanguage';

const TYPE_ICON = {
  trip_assigned: Route,
  trip_cancelled: AlertTriangle,
  trip_completed: CheckCheck,
};

const TYPE_COLOR = {
  trip_assigned:  'var(--color-primary)',
  trip_cancelled: 'var(--color-danger, #ef4444)',
  trip_completed: 'var(--color-success, #22c55e)',
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DriverNotifications({ onSeen }) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationService.getNotifications({ limit: 50 });
      setNotifications(res?.data?.notifications ?? []);

      // Mark all as seen immediately when the screen opens
      await notificationService.markAllAsRead();
      // Tell the parent layout badge is now 0
      if (onSeen) onSeen();
    } catch (err) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [onSeen]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="driver-page" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Bell size={20} style={{ color: 'var(--color-primary)' }} />
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
          {t('nav_driver.notifications') || 'Notifications'}
        </h1>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
          Loading…
        </div>
      )}

      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger, #ef4444)' }}>
          {error}
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '4rem 1rem', color: 'var(--text-secondary)', gap: '0.75rem'
        }}>
          <BellOff size={42} style={{ opacity: 0.35 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {t('notifications.empty') || 'No notifications yet'}
          </p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {notifications.map(n => {
            const Icon  = TYPE_ICON[n.type] || Bell;
            const color = TYPE_COLOR[n.type] || 'var(--color-primary)';
            return (
              <li
                key={n.id}
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  alignItems: 'flex-start',
                  background: n.isRead ? 'var(--surface-secondary, var(--card-bg))' : 'var(--surface-highlight, rgba(99,102,241,.08))',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1rem',
                  border: n.isRead ? '1px solid var(--border-color)' : '1px solid var(--color-primary)',
                  transition: 'background 0.2s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={17} style={{ color }} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: n.isRead ? 500 : 700, fontSize: '0.88rem', lineHeight: 1.4 }}>
                    {n.title}
                  </p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {n.body}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, var(--text-secondary))', marginTop: '0.3rem', display: 'block' }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>

                {/* Unread dot */}
                {!n.isRead && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--color-primary)',
                    flexShrink: 0, marginTop: 4,
                  }} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
