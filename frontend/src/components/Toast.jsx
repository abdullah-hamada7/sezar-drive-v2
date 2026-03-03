import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export default function Toast({ message, type, duration, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: Info },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: CheckCircle },
    warning: { bg: '#fefce8', border: '#fde047', color: '#a16207', icon: AlertTriangle },
    error: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: AlertCircle },
  };

  const style = styles[type] || styles.info;
  const Icon = style.icon;

  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      color: style.color,
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      minWidth: '300px',
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <Icon size={20} />
      <p style={{ margin: 0, flex: 1, fontSize: '0.875rem' }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
        <X size={16} />
      </button>
    </div>
  );
}
