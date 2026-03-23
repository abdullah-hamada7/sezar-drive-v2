import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PromptModal(props) {
  if (!props.isOpen) return null;
  return <PromptModalContent {...props} />;
}

function PromptModalContent({
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
  maxLength,
  size = 'sm',
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const safeClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (required && !value.trim()) return;
    if (submitting) return;
    setSubmitting(true);
    let shouldClose = false;
    try {
      await Promise.resolve(onConfirm(value));
      shouldClose = true;
    } finally {
      setSubmitting(false);
      if (shouldClose) onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={safeClose}>
      <div className={`modal modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title || t('common.prompt')}</h2>
          <button className="btn-icon" onClick={safeClose} disabled={submitting}><X size={18} /></button>
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
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                maxLength={typeof maxLength === 'number' ? maxLength : undefined}
                required={required}
                disabled={submitting}
                style={{ width: '100%' }}
              />
              {typeof maxLength === 'number' && (
                <div className="text-xs text-muted" style={{ marginTop: 6, textAlign: 'end' }}>
                  {Math.min(value.length, maxLength)}/{maxLength}
                </div>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={safeClose} disabled={submitting}>
              {cancelText || t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || (required && !value.trim())}>
              {confirmText || t('common.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
