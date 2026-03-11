import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { authService as api } from '../../services/auth.service';
import { Check, X, User, Loader, ClipboardCheck } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import PromptModal from '../common/PromptModal';

export default function VerificationQueue() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterName, setFilterName] = useState('');
  const [promptData, setPromptData] = useState({ isOpen: false, itemId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterName) params.append('name', filterName);

      const res = await api.getPendingShiftVerifications(params.toString());
      setItems(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterStatus, filterName]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(shiftId, decision, reason = null) {
    setProcessing(shiftId);
    try {
      await api.reviewShiftVerification(shiftId, decision, reason);
      addToast(
        decision === 'APPROVE'
          ? t('verification.messages.success_approve')
          : t('verification.messages.success_reject'),
        'success'
      );
      setItems(prev => prev.filter(i => i.id !== shiftId));
    } catch (err) {
      addToast(err.message || t('verification.messages.review_failed'), 'error');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) return <div>{t('verification.messages.loading_queue')}</div>;

  if (items.length === 0) {
    return (
      <div className="card text-center py-xl border-dashed">
        <div className="text-muted flex flex-col items-center gap-sm">
          <ClipboardCheck size={32} style={{ opacity: 0.5 }} />
          <span>{t('verification.card.empty')}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <h3 className="text-lg font-bold">{t('verification.title')}</h3>
          <span className="badge badge-warning" style={{ borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
            {items.length}
          </span>
        </div>

        <div className="flex gap-sm">
          <select
            className="form-input"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ width: 'auto', minWidth: '120px' }}
          >
            <option value="pending">{t('verification.filter.pending')}</option>
            <option value="approved">{t('verification.filter.approved')}</option>
            <option value="rejected">{t('verification.filter.rejected')}</option>
            <option value="all">{t('verification.filter.all')}</option>
          </select>
          <div className="flex gap-xs">
            <input
              type="text"
              className="form-input"
              style={{ minWidth: '220px' }}
              placeholder={t('verification.search_driver_placeholder')}
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
            />
            <button className="btn btn-sm btn-primary" onClick={load}>{t('common.search')}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-3 gap-md">
        {items.map(item => (
          <div key={item.id} className="card card-hover p-0 overflow-hidden flex flex-col border-boundary">

            {/* Header */}
            <div className="p-md flex justify-between items-start bg-tertiary border-b border-boundary">
              <div className="flex items-center gap-sm">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                  <User size={16} />
                </div>
                <div>
                  <div className="font-bold text-sm">{item.driver?.name}</div>
                  <div className="text-xs text-muted">{t('verification.card.id_short')}: ...{item.driver?.id?.slice(-4)}</div>
                </div>
              </div>
              <span className="text-xs text-muted bg-white/10 px-2 py-1 rounded">
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Images Comparison */}
            {/* Images Comparison */}
            <div className="p-md grid grid-2 gap-md flex-1">
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-muted font-bold uppercase tracking-wider">{t('verification.card.profile_photo')}</span>
                <div className="aspect-square overflow-hidden rounded-md border border-boundary group relative">
                  <img
                    src={item.driver?.avatarUrl || 'https://via.placeholder.com/150'}
                    alt={t('verification.card.profile_photo')}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-muted font-bold uppercase tracking-wider text-primary">{t('verification.card.shift_selfie')}</span>
                <div className="aspect-square overflow-hidden rounded-md border-2 border-primary cursor-zoom-in relative group" onClick={() => window.open(item.startSelfieUrl, '_blank')}>
                  <img
                    src={item.startSelfieUrl || 'https://via.placeholder.com/150'}
                    alt={t('verification.card.shift_selfie')}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                    {t('verification.card.zoom')}
                  </div>
                </div>
              </div>
            </div>

            {/* ID Cards */}
            <div className="p-md pt-0 grid grid-2 gap-md">
              {item.driver?.idCardFront && (
                <div className="flex flex-col gap-xs">
                  <span className="text-xs text-muted font-bold uppercase tracking-wider">{t('verification.card.id_front')}</span>
                  <div className="aspect-video overflow-hidden rounded-md border border-boundary group relative cursor-zoom-in" onClick={() => window.open(item.driver.idCardFront, '_blank')}>
                    <img src={item.driver.idCardFront} alt={t('verification.card.id_front')} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              {item.driver?.idCardBack && (
                <div className="flex flex-col gap-xs">
                  <span className="text-xs text-muted font-bold uppercase tracking-wider">{t('verification.card.id_back')}</span>
                  <div className="aspect-video overflow-hidden rounded-md border border-boundary group relative cursor-zoom-in" onClick={() => window.open(item.driver.idCardBack, '_blank')}>
                    <img src={item.driver.idCardBack} alt={t('verification.card.id_back')} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-md pt-0 flex gap-md mt-auto">
              <button
                className="btn btn-success flex-1"
                onClick={() => handleReview(item.id, 'APPROVE')}
                disabled={processing === item.id}
                title={t('verification.card.approve')}
              >
                {processing === item.id ? <Loader size={18} className="spinning" /> : <Check size={18} />}
                {t('verification.card.approve')}
              </button>
              <button
                className="btn btn-danger flex-1"
                onClick={() => setPromptData({ isOpen: true, itemId: item.id })}
                disabled={processing === item.id}
                title={t('verification.card.reject')}
              >
                <X size={18} /> {t('verification.card.reject')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <PromptModal
        isOpen={promptData.isOpen}
        onClose={() => setPromptData({ isOpen: false, itemId: null })}
        onConfirm={(reason) => handleReview(promptData.itemId, 'REJECT', reason)}
        title={t('verification.card.reject')}
        message={t('verification.messages.reject_prompt')}
        placeholder={t('verification.messages.reject_reason_placeholder')}
      />
    </div>
  );
}
