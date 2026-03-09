import { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { authService as api } from '../../services/auth.service';
import { Check, X, User, Image } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import PromptModal from '../../components/common/PromptModal';

export default function VerificationQueue() {
  const { t } = useTranslation();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useContext(ToastContext);

  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [status, setStatus] = useState('pending');

  const [confirmData, setConfirmData] = useState({ isOpen: false, item: null, action: null });
  const [promptData, setPromptData] = useState({ isOpen: false, item: null });

  const loadPending = useCallback(async () => {
    try {
      const query = new URLSearchParams({ sortBy, sortOrder, status }).toString();
      const res = await api.getPendingVerifications(query);
      setPending(res.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, sortBy, sortOrder, status]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const handleUpdate = () => loadPending();
    window.addEventListener('ws:identity_upload', handleUpdate);
    window.addEventListener('ws:identity_reviewed', handleUpdate);
    return () => {
      window.removeEventListener('ws:identity_upload', handleUpdate);
      window.removeEventListener('ws:identity_reviewed', handleUpdate);
    };
  }, [loadPending]);

  async function handleReview(id, decision, reason = '') {
    const action = decision.toLowerCase();
    try {
      await api.reviewIdentity(id, {
        action: action,
        rejectionReason: reason
      });
      loadPending();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (loading) return (
    <div className="loading-page">
      <div className="spinner"></div>
      <p>{t('common.loading')}</p>
    </div>
  );

  return (
    <div className="verification-queue-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('verification.title')}</h1>
          <p className="page-subtitle">{t('verification.subtitle') || 'Review and manage driver identities'}</p>
        </div>
        <div className="flex gap-sm">
          <select
            className="form-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="createdAt">{t('verification.sort.date')}</option>
            <option value="driverName">{t('drivers.table.name')}</option>
          </select>
          <select
            className="form-select"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="desc">{t('verification.sort.newest')}</option>
            <option value="asc">{t('verification.sort.oldest')}</option>
          </select>
        </div>
      </div>

      <div className="card mb-md glass-card" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="flex items-center justify-between">
          <div className="flex gap-xs">
            {['pending', 'approved', 'rejected', 'all'].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: status === s ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  minWidth: '80px',
                  textTransform: 'capitalize'
                }}
                onClick={() => { setStatus(s); setLoading(true); }}
              >
                {t(`common.status.${s.toLowerCase()}`) || s}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted uppercase font-bold" style={{ letterSpacing: '0.05em' }}>
            {pending.length} {t('verification.title')}
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="card p-xl text-center glass-card" style={{ marginTop: '2rem' }}>
          <div className="text-muted mb-md"><User size={48} style={{ opacity: 0.2, margin: '0 auto' }} /></div>
          <p className="font-bold text-lg">{t('verification.card.empty')}</p>
          <p className="text-sm text-muted">{t('verification.messages.no_pending_desc') || 'All caught up! No verifications match your filter.'}</p>
        </div>
      ) : (
        <div className="grid gap-md">
          {pending.map(item => (
            <div key={item.id} className="card" style={{ padding: 'var(--space-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <div className="flex gap-md items-start" style={{ marginBottom: 'var(--space-sm)' }}>
                <div style={{ flex: 1 }}>
                  <h3 className="font-bold">{item.driver?.name || t('verification.card.unknown')}</h3>
                  <p className="text-muted text-sm">{item.driver?.email} | {item.driver?.phone}</p>
                  <p className="text-xs text-muted">{t('verification.card.submitted', { date: new Date(item.createdAt).toLocaleString() })}</p>
                </div>
                <span className={`badge badge-status ${item.status === 'approved' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                  {t(`common.status.${(item.status || 'pending').toLowerCase()}`)}
                </span>
              </div>

              {/* Photos Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', margin: 'var(--space-md) 0' }}>
                {[
                  { url: item.photoUrl, label: t('verification.card.selfie') },
                  { url: item.idCardFront || item.driver?.idCardFront, label: t('verification.card.id_front') },
                  { url: item.idCardBack || item.driver?.idCardBack, label: t('verification.card.id_back') },
                ].map(({ url, label }) => (
                  <div key={label} style={{
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    aspectRatio: '4/3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    border: '1px solid var(--color-border)'
                  }}>
                    {url && url !== 'manual_verification' ? (
                      <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <Image size={20} style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-xs text-muted" style={{ marginTop: 4 }}>{t('verification.card.no_photo', { label })}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-xs mb-sm" style={{ justifyContent: 'center' }}>
                <span className="text-xs text-muted">{t('verification.card.selfie')}</span>
                <span className="text-xs text-muted" style={{ margin: '0 1.5rem' }}>{t('verification.card.id_front')}</span>
                <span className="text-xs text-muted">{t('verification.card.id_back')}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-sm" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)' }}>
                <button
                  className="btn btn-success btn-sm flex items-center gap-xs"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmData({ isOpen: true, item: item, action: 'APPROVE' })}
                >
                  <Check size={16} /> {t('verification.card.approve')}
                </button>
                <button
                  className="btn btn-danger btn-sm flex items-center gap-xs"
                  style={{ flex: 1 }}
                  onClick={() => setPromptData({ isOpen: true, item: item })}
                >
                  <X size={16} /> {t('verification.card.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData({ isOpen: false, item: null, action: null })}
        onConfirm={() => handleReview(confirmData.item.id, confirmData.action)}
        title={t('verification.card.approve')}
        message={t('verification.messages.confirm_approve')}
        variant="success"
      />

      <PromptModal
        isOpen={promptData.isOpen}
        onClose={() => setPromptData({ isOpen: false, item: null })}
        onConfirm={(reason) => handleReview(promptData.item.id, 'REJECT', reason)}
        title={t('verification.card.reject')}
        message={t('verification.messages.reject_prompt')}
        placeholder={t('verification.messages.reject_reason_placeholder')}
      />
    </div>
  );
}
