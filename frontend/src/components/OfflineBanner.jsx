import { useOfflineSync } from '../hooks/useOfflineSync';
import { useTranslation } from 'react-i18next';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();

  if (isOnline && !isSyncing && pendingCount === 0) {
    return null;
  }

  const isOfflineState = !isOnline;
  const shouldShowTopBanner = isOfflineState || isSyncing;
  const backgroundColor = isOfflineState ? '#b45309' : '#166534';
  const message = isOfflineState
    ? `${t('common.offline.offline_mode')} (${t('common.offline.pending_short', { count: pendingCount })})`
    : t('common.offline.back_online_syncing');

  return (
    <>
      {shouldShowTopBanner && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            width: '100%',
            padding: '0.625rem 1rem',
            color: '#ffffff',
            background: backgroundColor,
            textAlign: 'center',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {message}
        </div>
      )}

      {pendingCount > 0 && isOnline && !isSyncing && (
        <div
          title={t('common.offline.pending_title', { count: pendingCount })}
          style={{
            position: 'fixed',
            right: '1rem',
            bottom: '1rem',
            zIndex: 1001,
            minWidth: '1.75rem',
            height: '1.75rem',
            padding: '0 0.45rem',
            borderRadius: '999px',
            background: '#f59e0b',
            color: '#111827',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(17, 24, 39, 0.15)',
          }}
        >
          {pendingCount}
        </div>
      )}
    </>
  );
}
