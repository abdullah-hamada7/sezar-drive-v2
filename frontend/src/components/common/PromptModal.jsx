import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PromptModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  placeholder,
  confirmText, 
  cancelText,
  initialValue = '',
  required = true,
  size = 'sm'
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setValue(initialValue);
  }

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (required && !value.trim()) return;
    onConfirm(value);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal-${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title || t('common.prompt')}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {message && <p className="text-sm mb-md" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input 
                autoFocus
                type="text" 
                className="form-input" 
                value={value} 
                onChange={e => setValue(e.target.value)}
                placeholder={placeholder}
                required={required}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {cancelText || t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={required && !value.trim()}>
              {confirmText || t('common.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
