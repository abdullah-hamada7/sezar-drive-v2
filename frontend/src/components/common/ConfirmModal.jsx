import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  cancelText,
  variant = 'danger', // danger | primary | success
  size = 'sm'
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger': return 'btn-danger';
      case 'success': return 'btn-success';
      default: return 'btn-primary';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal-${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title || t('common.confirm')}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText || t('common.cancel')}
          </button>
          <button className={`btn ${getConfirmButtonClass()}`} onClick={() => {
            onConfirm();
            onClose();
          }}>
            {confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
