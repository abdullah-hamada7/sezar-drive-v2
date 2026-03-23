import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { offlineQueue } from '../../services/offline-queue.service';
import { http } from '../../services/http.service';
import { ToastContext } from '../../contexts/toastContext';
import ConfirmModal from '../../components/common/ConfirmModal';

function emitToast(message, type = 'info', code = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, code } }));
}

function formatWhen(ts, locale) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale || undefined);
}

function typeKeyForEntry(entry) {
  const offlineType = entry?.body?.__offlineType;
  if (offlineType === 'inspection_bundle') return 'inspection';
  if (offlineType === 'expense_bundle') return 'expense';
  if (offlineType === 'damage_bundle') return 'damage';
  return 'request';
}

export default function DriverOfflineQueue() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await offlineQueue.getAll();
      setItems(all);
    } catch (err) {
      console.error(err);
      addToast(err?.message || t('common.error'), 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    load();
    const handleUpdated = () => load();
    window.addEventListener('offline-queue:updated', handleUpdated);
    return () => window.removeEventListener('offline-queue:updated', handleUpdated);
  }, [load]);

  const grouped = useMemo(() => {
    return items.map((entry) => ({
      id: entry.id,
      typeKey: typeKeyForEntry(entry),
      method: entry.method,
      endpoint: entry.endpoint,
      timestamp: entry.timestamp,
      retryCount: entry.retryCount || 0,
      idempotencyKey: entry.idempotencyKey,
    }));
  }, [items]);

  const syncNow = async () => {
    if (!isOnline || isSyncing || pendingCount === 0) return;
    setActionLoading(true);
    try {
      const result = await offlineQueue.sync(http);
      if (result?.synced > 0) {
        emitToast(t('common.offline.sync_success', { count: result.synced }), 'success', 'OFFLINE_SYNCED');
      } else if (result?.failed > 0) {
        emitToast(t('common.offline.sync_partial'), 'warning', 'OFFLINE_PARTIAL_SYNC');
      }
      await load();
    } catch {
      emitToast(t('common.offline.sync_failed'), 'warning', 'OFFLINE_SYNC_FAILED');
    } finally {
      setActionLoading(false);
    }
  };

  const removeItem = async (id) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await offlineQueue.remove(id);
      await load();
    } catch (err) {
      console.error(err);
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const clearAll = async () => {
    setActionLoading(true);
    try {
      await offlineQueue.clear();
      await load();
      addToast(t('common.offline.queue_cleared'), 'success');
    } catch (err) {
      console.error(err);
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('common.offline.queue_title')}</h1>
          <p className="page-subtitle">{t('common.offline.queue_subtitle')}</p>
        </div>
        <div className="flex gap-sm items-center">
          <span className={`badge ${isOnline ? 'badge-success' : 'badge-warning'}`}
            title={isOnline ? 'Online' : 'Offline'}
          >
            {isOnline ? t('common.online') : t('common.offline.offline')}
          </span>
          <span className="badge badge-warning" title={t('common.offline.pending_title', { count: pendingCount })}>
            {t('common.offline.pending_short', { count: pendingCount })}
          </span>
          <button className="btn btn-secondary" type="button" onClick={load} disabled={loading || actionLoading}>
            {t('common.offline.queue_refresh')}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={syncNow}
            disabled={!isOnline || isSyncing || pendingCount === 0 || actionLoading}
            title={!isOnline ? t('common.offline.action_requires_connection') : undefined}
          >
            {t('common.offline.queue_sync_now')}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => setClearConfirmOpen(true)}
            disabled={pendingCount === 0 || actionLoading}
          >
            {t('common.offline.queue_clear_all')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner"></div></div>
      ) : grouped.length === 0 ? (
        <div className="card empty-state">
          <p>{t('common.offline.queue_empty')}</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.offline.queue_col_type')}</th>
                    <th>{t('common.offline.queue_col_endpoint')}</th>
                    <th>{t('common.offline.queue_col_created')}</th>
                    <th>{t('common.offline.queue_col_retries')}</th>
                    <th>{t('common.offline.queue_col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 650 }}>{t(`common.offline.queue_type.${entry.typeKey}`)}</td>
                      <td>
                        <span className="font-mono" style={{ fontSize: '0.82rem' }}>
                          {entry.method} {entry.endpoint}
                        </span>
                        {entry.idempotencyKey ? (
                          <div className="text-xs text-muted font-mono" style={{ marginTop: 6 }}>
                            {t('common.offline.queue_idempotency')}: {String(entry.idempotencyKey).slice(0, 16)}
                          </div>
                        ) : null}
                      </td>
                      <td>{formatWhen(entry.timestamp, i18n.language)}</td>
                      <td>
                        <span className={`badge ${entry.retryCount > 0 ? 'badge-warning' : 'badge-neutral'}`}>
                          {entry.retryCount}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-sm">
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={() => removeItem(entry.id)}
                            disabled={actionLoading}
                          >
                            {t('common.offline.queue_remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          setClearConfirmOpen(false);
          clearAll();
        }}
        title={t('common.offline.queue_clear_confirm_title')}
        message={t('common.offline.queue_clear_confirm_message')}
        confirmText={t('common.offline.queue_clear_all')}
        variant="danger"
        size="sm"
      />
    </div>
  );
}
