import { X, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * sections: [
 *   {
 *     title: string,
 *     type: 'grid' | 'list' | 'photos' | 'checklist',
 *     items: [ { label: string, value: any, type: 'text' | 'badge' | 'boolean' } ] // for grid/list
 *     data: any // for checklist/photos
 *   }
 * ]
 */
export default function DetailModal({ isOpen, onClose, title, sections = [], actions, size = 'modal-lg' }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-body">
          <div className="flex flex-col gap-lg">
            {sections.map((section, idx) => (
              <div key={idx} className="detail-section">
                {section.title && (
                  <h3 className="text-xs uppercase text-muted font-bold mb-md tracking-wider">
                    {section.title}
                  </h3>
                )}

                {section.type === 'grid' && (
                  <div className="grid grid-2 gap-md border p-md rounded-md bg-surface-dark">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex flex-col">
                        <span className="text-xs text-muted mb-xs">{item.label}</span>
                        <div className="font-medium text-sm">
                          {item.type === 'badge' ? (
                            <span className={`badge ${item.badgeClass}`}>{item.value}</span>
                          ) : item.type === 'boolean' ? (
                            item.value ? (
                              <span className="text-success flex items-center gap-xs"><Check size={14} /> {t('common.yes')}</span>
                            ) : (
                              <span className="text-danger flex items-center gap-xs"><X size={14} /> {t('common.no')}</span>
                            )
                          ) : (
                            item.value || '—'
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section.type === 'checklist' && (
                  <div className="grid grid-2 gap-sm border p-md rounded-md">
                    {Object.entries(section.data || {}).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between p-sm rounded bg-bg-tertiary">
                        <span className="text-sm">{t(`inspection.checklist.${key}`) || key}</span>
                        {val ? (
                          <Check size={18} className="text-success" />
                        ) : (
                          <AlertCircle size={18} className="text-danger" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {section.type === 'photos' && (
                  <div className="grid grid-4 gap-sm">
                    {(section.data || []).map((p, i) => (
                      <div key={i} className="flex flex-col gap-xs text-center">
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border hover:border-primary transition-colors">
                          <img 
                            src={p.photoUrl} 
                            alt={p.label || `Photo ${i+1}`} 
                            className="w-full aspect-square object-cover"
                          />
                        </a>
                        {p.label && <span className="text-xs text-muted capitalize">{p.label}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {section.type === 'text' && (
                  <div className="p-md border rounded-md bg-bg-tertiary text-sm leading-relaxed whitespace-pre-wrap">
                    {section.content || '—'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {actions && (
          <div className="modal-actions">
            {actions}
          </div>
        )}
      </div>

      <style>{`
        .bg-surface-dark { background: rgba(0, 0, 0, 0.1); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 640px) {
          .grid-2, .grid-4 { grid-template-columns: 1fr; }
        }
        .text-success { color: var(--color-success); }
        .text-danger { color: var(--color-danger); }
        .border { border: 1px solid var(--color-border); }
        .rounded-md { border-radius: var(--radius-md); }
        .p-md { padding: var(--space-md); }
        .p-sm { padding: var(--space-sm); }
        .mb-xs { margin-bottom: var(--space-xs); }
        .gap-xs { gap: var(--space-xs); }
      `}</style>
    </div>
  );
}
