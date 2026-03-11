import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, User, Phone, Mail } from 'lucide-react';

export default function DriverDetailsModal({ driver, isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen || !driver) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t('drivers.modal.details_title')}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Profile Header */}
          <div className="flex items-center gap-md mb-xl" style={{
            padding: 'var(--space-md)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)'
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
              <h3 className="text-xl font-bold mb-xs">{driver.name}</h3>
              <div className="mb-xs">
                <span className={`badge badge-status ${driver.identityVerified ? 'badge-success' : 'badge-warning'}`}>
                  {driver.identityVerified ? t('common.status.verified') : t('common.status.pending')}
                </span>
              </div>
              <div className="flex items-center gap-xs" style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <CreditCard size={14} />
                {driver.licenseNumber || t('drivers.modal.not_provided')}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-2 gap-lg mb-xl">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="text-xs uppercase tracking-wider font-bold mb-xs block" style={{ color: 'var(--color-text-secondary)' }}>
                {t('drivers.table.email')}
              </label>
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                wordBreak: 'break-all'
              }}>
                <span className="flex items-center gap-xs">
                  <Mail size={14} />
                  {driver.email}
                </span>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="text-xs uppercase tracking-wider font-bold mb-xs block" style={{ color: 'var(--color-text-secondary)' }}>
                {t('drivers.table.phone')}
              </label>
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)'
              }}>
                <span className="flex items-center gap-xs">
                  <Phone size={14} />
                  {driver.phone || t('drivers.modal.not_provided')}
                </span>
              </div>
            </div>
          </div>

          {/* ID Cards Section */}
          <div>
            <label className="text-xs uppercase tracking-wider font-bold mb-sm block" style={{ color: 'var(--color-text-secondary)' }}>
              {t('drivers.modal.id_cards')}
            </label>
            <div className="grid grid-2 gap-md">
              <div className="flex flex-col gap-xs">
                <span className="text-xs mb-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t('drivers.modal.id_card_front')}
                </span>
                {driver.idCardFront ? (
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', height: '140px' }}>
                    <img src={driver.idCardFront} alt={t('drivers.modal.id_card_front')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    height: '140px', background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)', fontSize: '0.875rem'
                  }}>
                    {t('drivers.modal.not_uploaded')}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-xs mb-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t('drivers.modal.id_card_back')}
                </span>
                {driver.idCardBack ? (
                  <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', height: '140px' }}>
                    <img src={driver.idCardBack} alt={t('drivers.modal.id_card_back')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    height: '140px', background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)', fontSize: '0.875rem'
                  }}>
                    {t('drivers.modal.not_uploaded')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary w-full"
            onClick={() => {
              onClose();
              navigate('/change-password');
            }}
            style={{ padding: '0.75rem' }}
          >
            {t('auth.change_password')}
          </button>
          <button className="btn btn-secondary w-full" onClick={onClose} style={{ padding: '0.75rem' }}>
            {t('drivers.modal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
