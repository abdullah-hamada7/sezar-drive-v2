import { AlertTriangle, RotateCcw, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ListLoading({ label }) {
  const { t } = useTranslation();
  return (
    <div className="loading-page" style={{ minHeight: '300px' }}>
      <div className="spinner" />
      <div className="text-sm">{label || t('common.loading')}</div>
    </div>
  );
}

export function ListError({ message, onRetry, onClearFilters }) {
  const { t } = useTranslation();
  return (
    <div className="card list-state" role="alert" style={{ padding: '1rem' }}>
      <div className="flex items-start gap-md" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="flex items-start gap-sm">
          <AlertTriangle size={18} style={{ marginTop: 2, color: 'var(--color-danger)' }} />
          <div>
            <div style={{ fontWeight: 800 }}>{t('common.error')}</div>
            <div className="text-sm text-muted">{message || t('common.error')}</div>
          </div>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
          {typeof onClearFilters === 'function' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClearFilters}>
              {t('common.filters.clear')}
            </button>
          )}
          {typeof onRetry === 'function' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
              <RotateCcw size={14} /> {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ListEmpty({ title, subtitle }) {
  const { t } = useTranslation();
  return (
    <div className="card list-state" style={{ padding: '1.25rem', textAlign: 'center' }}>
      <div className="flex" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
        <Inbox size={22} className="text-muted" />
      </div>
      <div style={{ fontWeight: 900 }}>{title || t('common.no_data')}</div>
      {subtitle && <div className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>{subtitle}</div>}
    </div>
  );
}
