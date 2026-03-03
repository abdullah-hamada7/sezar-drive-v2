import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, CreditCard, User } from 'lucide-react';

export default function DriverDetailsModal({ driver, isOpen, onClose }) {
  const { t } = useTranslation();

  if (!isOpen || !driver) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h3 className="modal-title">{t('drivers.modal.details_title')}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Header Section */}
          <div className="flex items-center gap-md mb-lg" style={{ padding: 'var(--space-md)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
            <div style={{
              width: 80, height: 80,
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              border: '3px solid var(--color-bg)',
              boxShadow: 'var(--shadow-md)',
              background: '#eee',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {driver.avatarUrl || driver.profilePhotoUrl ? (
                <img src={driver.avatarUrl || driver.profilePhotoUrl} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={40} className="text-muted" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold mb-xs">{driver.name}</h3>
              <div className="text-muted text-sm flex items-center gap-xs">
                <CreditCard size={14} />
                {driver.licenseNumber || t('common.not_provided')}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-2 gap-md mb-lg">
            <div className="form-group">
              <label className="text-xs text-muted uppercase tracking-wider font-bold">{t('common.email')}</label>
              <div className="p-sm bg-bg-tertiary rounded border border-border">{driver.email}</div>
            </div>
            <div className="form-group">
              <label className="text-xs text-muted uppercase tracking-wider font-bold">{t('common.phone')}</label>
              <div className="p-sm bg-bg-tertiary rounded border border-border">{driver.phone || '—'}</div>
            </div>
          </div>

          {/* ID Cards */}
          <div className="mb-lg">
            <label className="text-xs text-muted uppercase tracking-wider font-bold mb-sm block">{t('drivers.modal.id_cards')}</label>
            <div className="grid grid-2 gap-md">
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-muted">{t('drivers.modal.id_card_front')}</span>
                {driver.idCardFront ? (
                  <img src={driver.idCardFront} alt="ID Front" className="rounded border border-border" style={{ height: '120px', objectFit: 'cover' }} />
                ) : (
                  <div className="p-md bg-bg-tertiary rounded border border-border flex items-center justify-center h-[120px] text-muted text-xs">{t('common.not_uploaded')}</div>
                )}
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-muted">{t('drivers.modal.id_card_back')}</span>
                {driver.idCardBack ? (
                  <img src={driver.idCardBack} alt="ID Back" className="rounded border border-border" style={{ height: '120px', objectFit: 'cover' }} />
                ) : (
                  <div className="p-md bg-bg-tertiary rounded border border-border flex items-center justify-center h-[120px] text-muted text-xs">{t('common.not_uploaded')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary w-full" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
