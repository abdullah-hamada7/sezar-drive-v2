import { useState, useEffect, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService as api } from '../../services/auth.service';
import { Check, X, Image } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import PromptModal from '../../components/common/PromptModal';
import Pagination from '../../components/common/Pagination';
import { ListEmpty, ListError, ListLoading } from '../../components/common/ListStates';

export default function VerificationQueue() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { addToast } = useContext(ToastContext);

  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '15', 10) || 15, 1), 100);
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const status = searchParams.get('status') || 'pending';
  const name = searchParams.get('name') || '';

  const setQuery = useCallback((next) => {
    const merged = { page, limit, sortBy, sortOrder, status, name, ...next };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v == null) return;
      const s = String(v);
      if (!s) return;
      params.set(k, s);
    });
    setSearchParams(params, { replace: true });
  }, [limit, name, page, setSearchParams, sortBy, sortOrder, status]);

  const clearFilters = useCallback(() => {
    setQuery({ page: 1, name: '', status: 'pending', sortBy: 'createdAt', sortOrder: 'desc', limit: 15 });
  }, [setQuery]);

  const [confirmData, setConfirmData] = useState({ isOpen: false, item: null, action: null });
  const [promptData, setPromptData] = useState({ isOpen: false, item: null });
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
        status,
      });
      if (name) query.set('name', name);

      const res = await api.getPendingVerifications(query.toString());
      setPending(res.data?.verifications || []);
      setPagination(res.data || { page, limit, totalPages: 1, total: 0 });
    } catch (err) {
      console.error(err);
      const msg = err?.message || t('common.error');
      setLoadError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, limit, name, page, sortBy, sortOrder, status, t]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const handleUpdate = () => loadPending();
    window.addEventListener('ws:identity_upload', handleUpdate);
    window.addEventListener('ws:identity_reviewed', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    return () => {
      window.removeEventListener('ws:identity_upload', handleUpdate);
      window.removeEventListener('ws:identity_reviewed', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
    };
  }, [loadPending]);

  async function handleReview(id, decision, reason = '') {
    const action = decision.toLowerCase();
    try {
      setActionLoadingId(id);
      await api.reviewIdentity(id, {
        action: action,
        rejectionReason: reason
      });
      await loadPending();
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="verification-queue-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('verification.title')}</h1>
          <p className="page-subtitle">{t('verification.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="flex gap-xs" style={{ alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ minWidth: 220 }}
              placeholder={t('verification.search_driver_placeholder')}
              value={name}
              onChange={(e) => setQuery({ page: 1, name: e.target.value })}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              {t('common.filters.clear')}
            </button>
          </div>
          <select
            className="form-select"
            value={sortBy}
            onChange={e => setQuery({ page: 1, sortBy: e.target.value })}
            style={{ width: 'auto' }}
          >
            <option value="createdAt">{t('verification.sort.date')}</option>
            <option value="updatedAt">{t('common.sort.updated_at')}</option>
          </select>
          <select
            className="form-select"
            value={sortOrder}
            onChange={e => setQuery({ page: 1, sortOrder: e.target.value })}
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
                 onClick={() => setQuery({ page: 1, status: s })}
               >
                 {t(`verification.filter.${s.toLowerCase()}`)}
               </button>
             ))}
           </div>
          <p className="text-xs text-muted uppercase font-bold" style={{ letterSpacing: '0.05em' }}>
            {pending.length} {t('verification.title')}
          </p>
        </div>
      </div>

      {loading ? (
        <ListLoading />
      ) : loadError ? (
        <ListError message={loadError} onRetry={loadPending} onClearFilters={clearFilters} />
      ) : pending.length === 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <ListEmpty title={t('verification.card.empty')} subtitle={t('verification.messages.no_pending_desc')} />
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
                  {t(`common.status.${(item.status ?? 'pending').toLowerCase()}`)}
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
                  disabled={actionLoadingId === item.id}
                  onClick={() => setConfirmData({ isOpen: true, item: item, action: 'APPROVE' })}
                >
                  <Check size={16} /> {t('verification.card.approve')}
                </button>
                <button
                  className="btn btn-danger btn-sm flex items-center gap-xs"
                  style={{ flex: 1 }}
                  disabled={actionLoadingId === item.id}
                  onClick={() => setPromptData({ isOpen: true, item: item })}
                >
                  <X size={16} /> {t('verification.card.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={pagination.page || page}
        totalPages={pagination.totalPages || 1}
        pageSize={pagination.limit || limit}
        onPageChange={(p) => setQuery({ page: p })}
        onPageSizeChange={(s) => setQuery({ page: 1, limit: s })}
      />

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
