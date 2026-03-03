import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { expenseService as api } from '../../services/expense.service';
import { Receipt, CheckCircle, XCircle, Eye, X } from 'lucide-react';
import { useContext } from 'react';
import { ToastContext } from '../../contexts/toastContext';
import PromptModal from '../../components/common/PromptModal';
import DetailModal from '../../components/common/DetailModal';

const STATUS_BADGES = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [promptData, setPromptData] = useState({ isOpen: false, expenseId: null });
  const statusLabel = statusFilter ? t(`admin_expenses.filter.${statusFilter}`) : t('admin_expenses.filter.all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 15 });
        if (statusFilter) params.set('status', statusFilter);
        const res = await api.getExpenses(params.toString());
        setExpenses(res.data.expenses || []);
        setPagination(res.data || {});
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [page, statusFilter, refresh]);

  useEffect(() => {
    const handleUpdate = () => setRefresh(r => r + 1);
    window.addEventListener('ws:expense_pending', handleUpdate);
    window.addEventListener('ws:expense_reviewed', handleUpdate);
    return () => {
      window.removeEventListener('ws:expense_pending', handleUpdate);
      window.removeEventListener('ws:expense_reviewed', handleUpdate);
    };
  }, []);

  async function handleReview(id, action, reason = null) {
    if (action === 'rejected' && !reason) {
      setPromptData({ isOpen: true, expenseId: id });
      return;
    }
    try {
      await api.reviewExpense(id, { action, rejectionReason: reason });
      setRefresh(r => r + 1);
      setSelected(null);
    } catch (err) { addToast(err.message || t('common.error'), 'error'); }
  }

  function formatDate(d) { return d ? new Date(d).toLocaleDateString() : '—'; }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin_expenses.title')}</h1>
          <p className="page-subtitle">{t('admin_expenses.subtitle')}</p>
        </div>
        <div className="flex gap-sm">
          {['', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter(s); setPage(1); }}>
              {s ? t(`admin_expenses.filter.${s}`) : t('admin_expenses.filter.all')}
            </button>
          ))}
        </div>
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('admin_expenses.table.status')}</span>
              <span className="badge badge-neutral">{statusLabel}</span>
            </div>
            <span className="badge badge-info">{expenses.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-page"><div className="spinner"></div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('admin_expenses.table.driver')}</th>
                <th>{t('admin_expenses.table.category')}</th>
                <th>{t('admin_expenses.table.amount')}</th>
                <th>{t('admin_expenses.table.description')}</th>
                <th>{t('admin_expenses.table.status')}</th>
                <th>{t('admin_expenses.table.date')}</th>
                <th>{t('admin_expenses.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">{t('admin_expenses.table.empty')}</td></tr>
              ) : expenses.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.driver?.name || '—'}</td>
                  <td>{e.category?.name || '—'}</td>
                  <td>{parseFloat(e.amount).toFixed(2)} EGP</td>
                  <td className="text-sm">{e.description || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGES[e.status]}`}>{t(`common.status.${e.status.toLowerCase()}`)}</span></td>
                  <td className="text-sm text-muted">{formatDate(e.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => setSelected(e)} title={t('common.view')}><Eye size={16} /></button>
                      {e.status === 'pending' && (
                        <>
                          <button className="btn-icon" onClick={() => handleReview(e.id, 'approved')} style={{ color: 'var(--color-success)' }} title={t('admin_expenses.modal.approve')}><CheckCircle size={16} /></button>
                          <button className="btn-icon" onClick={() => handleReview(e.id, 'rejected')} style={{ color: 'var(--color-danger)' }} title={t('admin_expenses.modal.reject')}><XCircle size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>{t('vehicles.pagination.prev')}</button>
          <span className="text-sm text-muted">{t('vehicles.pagination.info', { current: page, total: pagination.totalPages })}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>{t('vehicles.pagination.next')}</button>
        </div>
      )}

      {selected && (
        <DetailModal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={t('admin_expenses.modal.title')}
          size="modal-md"
          sections={[
            {
              title: t('common.details'),
              type: 'grid',
              items: [
                { label: t('admin_expenses.table.driver'), value: selected.driver?.name },
                { label: t('admin_expenses.table.category'), value: selected.category?.name },
                { label: t('admin_expenses.table.amount'), value: `${parseFloat(selected.amount).toFixed(2)} EGP` },
                { label: t('admin_expenses.table.date'), value: formatDate(selected.createdAt) },
                {
                  label: t('admin_expenses.table.status'),
                  value: t(`common.status.${selected.status.toLowerCase()}`),
                  type: 'badge',
                  badgeClass: STATUS_BADGES[selected.status]
                },
              ]
            },
            selected.description && {
              title: t('admin_expenses.table.description'),
              type: 'text',
              content: selected.description
            },
            selected.receiptUrl && {
              title: t('admin_expenses.modal.receipt'),
              type: 'photos',
              data: [{ photoUrl: selected.receiptUrl, label: t('admin_expenses.modal.receipt') }]
            }
          ].filter(Boolean)}
          actions={selected.status === 'pending' && (
            <div className="flex gap-sm">
              <button className="btn btn-success" onClick={() => handleReview(selected.id, 'approved')}>
                <CheckCircle size={16} /> {t('admin_expenses.modal.approve')}
              </button>
              <button className="btn btn-danger" onClick={() => handleReview(selected.id, 'rejected')}>
                <XCircle size={16} /> {t('admin_expenses.modal.reject')}
              </button>
            </div>
          )}
        />
      )}

      <PromptModal
        isOpen={promptData.isOpen}
        onClose={() => setPromptData({ isOpen: false, expenseId: null })}
        onConfirm={(reason) => handleReview(promptData.expenseId, 'rejected', reason)}
        title={t('admin_expenses.modal.reject')}
        message={t('admin_expenses.modal.reject_prompt')}
        placeholder={t('admin_expenses.modal.reason_placeholder')}
      />
    </div>
  );
}
