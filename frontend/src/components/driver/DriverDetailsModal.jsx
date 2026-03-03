import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, CreditCard, User } from 'lucide-react';

export default function DriverDetailsModal({ driver, isOpen, onClose }) {
  const { t } = useTranslation();

  if (!isOpen || !driver) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', padding: '0', overflow: 'hidden' }}>
        <div className="modal-header" style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-secondary)' }}>
          <h3 className="modal-title m-0 text-lg">{t('drivers.modal.details_title')}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 'var(--space-lg)' }}>
          {/* Profile Header */}
          <div className="flex items-center gap-md mb-xl" style={{
            padding: 'var(--space-md)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)'
          }}>
            <div style={{
              width: 88, height: 88,
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              border: '3px solid var(--color-bg)',
              boxShadow: 'var(--shadow-sm)',
              background: 'var(--color-bg-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              {driver.avatarUrl || driver.profilePhotoUrl ? (
                <img src={driver.avatarUrl || driver.profilePhotoUrl} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={40} style={{ color: 'var(--color-text-muted)' }} />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-xs" style={{ color: 'var(--color-text-primary)' }}>{driver.name}</h3>
              <div className="flex items-center gap-xs" style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <CreditCard size={14} />
                {driver.licenseNumber || t('common.not_provided') || 'Not Provided'}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-2 gap-lg mb-xl">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="text-xs uppercase tracking-wider font-bold mb-xs block" style={{ color: 'var(--color-text-secondary)' }}>
                {t('common.email') || 'Email'}
              </label>
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                wordBreak: 'break-all'
              }}>
                {driver.email}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="text-xs uppercase tracking-wider font-bold mb-xs block" style={{ color: 'var(--color-text-secondary)' }}>
                {t('common.phone') || 'Phone'}
              </label>
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)'
              }}>
                {driver.phone || '—'}
              </div>
            </div>
          </div>

          {/* ID Cards Section */}
          <div>
            <label className="text-xs uppercase tracking-wider font-bold mb-sm block" style={{ color: 'var(--color-text-secondary)' }}>
              {t('drivers.modal.id_cards') || 'Identity Documents'}
            </label>
            <div className="grid grid-2 gap-md">
              <div className="flex flex-col gap-xs">
                <span className="text-xs mb-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t('drivers.modal.id_card_front') || 'ID Front'}
                </span>
                {driver.idCardFront ? (
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)', height: '140px' }}>
                    <img src={driver.idCardFront} alt="ID Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    height: '140px', background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)', fontSize: '0.875rem'
                  }}>
                    {t('common.not_uploaded') || 'Pending'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-xs mb-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t('drivers.modal.id_card_back') || 'ID Back'}
                </span>
                {driver.idCardBack ? (
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)', height: '140px' }}>
                    <img src={driver.idCardBack} alt="ID Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    height: '140px', background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)', fontSize: '0.875rem'
                  }}>
                    {t('common.not_uploaded') || 'Pending'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: 'var(--space-md) var(--space-lg)', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-secondary)' }}>
          <button className="btn btn-secondary w-full" onClick={onClose} style={{ padding: '0.75rem' }}>
            {t('common.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
