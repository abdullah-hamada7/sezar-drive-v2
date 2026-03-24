import { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { expenseService as api } from '../../services/expense.service';
import { Receipt, CheckCircle, XCircle, Eye, Download } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import PromptModal from '../../components/common/PromptModal';
import DetailModal from '../../components/common/DetailModal';
import Pagination from '../../components/common/Pagination';
import { ListError, ListLoading } from '../../components/common/ListStates';
import { downloadApiFile } from '../../utils/download';

const STATUS_BADGES = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger', DEFAULT: 'badge-neutral' };

function statusKey(status) {
  return String(status || '').toLowerCase();
}

export default function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || '15', 10) || 15;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams]);
  const statusFilter = useMemo(() => String(searchParams.get('status') || ''), [searchParams]);
  const tripSearch = useMemo(() => String(searchParams.get('tripSearch') || ''), [searchParams]);
  const categoryId = useMemo(() => String(searchParams.get('categoryId') || ''), [searchParams]);
  const startDate = useMemo(() => String(searchParams.get('startDate') || ''), [searchParams]);
  const endDate = useMemo(() => String(searchParams.get('endDate') || ''), [searchParams]);
  const minAmount = useMemo(() => String(searchParams.get('minAmount') || ''), [searchParams]);
  const maxAmount = useMemo(() => String(searchParams.get('maxAmount') || ''), [searchParams]);
  const hasReceipt = useMemo(() => String(searchParams.get('hasReceipt') || ''), [searchParams]);
  const sortBy = useMemo(() => String(searchParams.get('sortBy') || ''), [searchParams]);
  const sortOrder = useMemo(() => String(searchParams.get('sortOrder') || ''), [searchParams]);
  const expenseId = useMemo(() => String(searchParams.get('expenseId') || ''), [searchParams]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [promptData, setPromptData] = useState({ isOpen: false, expenseId: null, expenseIds: null });
  const statusLabel = statusFilter ? t(`admin_expenses.filter.${statusFilter}`) : t('admin_expenses.filter.all');

  const [categories, setCategories] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reviewingIds, setReviewingIds] = useState(() => new Set());

  const rowIdsOnPage = useMemo(
    () => expenses.map((e) => String(e.id)),
    [expenses]
  );

  const pendingIdsOnPage = useMemo(
    () => expenses.filter((e) => statusKey(e.status) === 'pending').map((e) => String(e.id)),
    [expenses]
  );

  const selectedPendingIds = useMemo(
    () => selectedIds.filter((id) => pendingIdsOnPage.includes(String(id))),
    [pendingIdsOnPage, selectedIds]
  );

  const allSelectedOnPage = useMemo(
    () => rowIdsOnPage.length > 0 && rowIdsOnPage.every((id) => selectedIds.includes(id)),
    [rowIdsOnPage, selectedIds]
  );

  const someSelectedOnPage = useMemo(
    () => rowIdsOnPage.some((id) => selectedIds.includes(id)),
    [rowIdsOnPage, selectedIds]
  );

  const selectAllRef = useRef(null);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = !allSelectedOnPage && someSelectedOnPage;
  }, [allSelectedOnPage, someSelectedOnPage]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (statusFilter) params.set('status', statusFilter);
      if (tripSearch.trim()) params.set('tripSearch', tripSearch.trim());
      if (categoryId) params.set('categoryId', categoryId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      if (hasReceipt) params.set('hasReceipt', hasReceipt);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);
      if (expenseId) params.set('expenseId', expenseId);

      const res = await api.getExpenses(params.toString());
      const rows = res.data.expenses || [];
      setExpenses(rows);
      setPagination(res.data || {});
      const rowIds = new Set(rows.map((e) => String(e.id)));
      setSelectedIds((prev) => prev.filter((id) => rowIds.has(String(id))));
    } catch (err) {
      console.error(err);
      const msg = err?.message || t('common.error');
      setLoadError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, categoryId, endDate, expenseId, hasReceipt, limit, maxAmount, minAmount, page, sortBy, sortOrder, startDate, statusFilter, t, tripSearch]);

  useEffect(() => { load(); }, [load, refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getExpenseCategories();
        if (cancelled) return;
        const cats = Array.isArray(res?.data) ? res.data : (res?.data?.categories || res?.data?.data || []);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleUpdate = () => setRefresh(r => r + 1);
    window.addEventListener('ws:expense_pending', handleUpdate);
    window.addEventListener('ws:expense_update', handleUpdate);
    window.addEventListener('ws:expense_reviewed', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    return () => {
      window.removeEventListener('ws:expense_pending', handleUpdate);
      window.removeEventListener('ws:expense_update', handleUpdate);
      window.removeEventListener('ws:expense_reviewed', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
    };
  }, []);

  async function handleReview(id, action, reason = null) {
    if (action === 'rejected' && !reason) {
      setPromptData({ isOpen: true, expenseId: id, expenseIds: null });
      return;
    }
    setReviewingIds((prev) => new Set([...prev, String(id)]));
    try {
      await api.reviewExpense(id, { action, rejectionReason: reason });
      setRefresh(r => r + 1);
      setSelected(null);
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
    }
  }

  async function handleBulkApprove() {
    if (!selectedPendingIds.length) return;
    setBulkLoading(true);
    try {
      await api.reviewExpensesBulk({ expenseIds: selectedPendingIds, action: 'approved' });
      setSelectedIds([]);
      setRefresh((r) => r + 1);
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setBulkLoading(false);
    }
  }

  function handleBulkRejectOpen() {
    if (!selectedPendingIds.length) return;
    setPromptData({ isOpen: true, expenseId: null, expenseIds: selectedPendingIds });
  }

  async function handleBulkReject(reason) {
    if (!selectedPendingIds.length) return;
    setBulkLoading(true);
    try {
      await api.reviewExpensesBulk({ expenseIds: selectedPendingIds, action: 'rejected', rejectionReason: reason });
      setSelectedIds([]);
      setRefresh((r) => r + 1);
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (tripSearch.trim()) params.set('tripSearch', tripSearch.trim());
      if (categoryId) params.set('categoryId', categoryId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      if (hasReceipt) params.set('hasReceipt', hasReceipt);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);
      if (expenseId) params.set('expenseId', expenseId);

      await downloadApiFile({
        endpoint: `/expenses/export?${params.toString()}`,
        filename: `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  const numberFmt = useMemo(() => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [i18n.language]);

  function formatDate(d) {
    return d ? new Date(d).toLocaleDateString(i18n.language) : '—';
  }

  function setRowSelected(id, checked) {
    const key = String(id);
    setSelectedIds((prev) => {
      const has = prev.includes(key);
      if (checked && !has) return [...prev, key];
      if (!checked && has) return prev.filter((x) => x !== key);
      return prev;
    });
  }

  function setAllRowsSelected(checked) {
    if (!rowIdsOnPage.length) return;
    setSelectedIds((prev) => {
      if (!checked) return prev.filter((id) => !rowIdsOnPage.includes(String(id)));
      const next = new Set(prev.map(String));
      rowIdsOnPage.forEach((id) => next.add(String(id)));
      return Array.from(next);
    });
  }

  const sortPreset = useMemo(() => {
    const sBy = String(sortBy || '');
    const sOrder = String(sortOrder || '');
    if (!sBy && !sOrder) return 'created_desc';
    if (sBy === 'createdAt' && sOrder === 'asc') return 'created_asc';
    if (sBy === 'createdAt' && sOrder === 'desc') return 'created_desc';
    if (sBy === 'amount' && sOrder === 'asc') return 'amount_asc';
    if (sBy === 'amount' && sOrder === 'desc') return 'amount_desc';
    if (sBy === 'status' && sOrder === 'asc') return 'status_asc';
    if (sBy === 'status' && sOrder === 'desc') return 'status_desc';
    return 'created_desc';
  }, [sortBy, sortOrder]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin_expenses.title')}</h1>
          <p className="page-subtitle">{t('admin_expenses.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <Download size={18} />} {t('common.export_csv')}
          </button>
          {['', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setQuery({ status: s, page: 1 })}>
              {s ? t(`admin_expenses.filter.${s}`) : t('admin_expenses.filter.all')}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="grid grid-4 gap-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.trip_search_label')}</label>
            <input
              className="form-input"
              value={tripSearch}
              onChange={(e) => setQuery({ tripSearch: e.target.value, page: 1 })}
              placeholder={t('admin_expenses.filters.trip_search_placeholder')}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.date_from')}</label>
            <input type="date" className="form-input" value={startDate} onChange={(e) => setQuery({ startDate: e.target.value, page: 1 })} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.date_to')}</label>
            <input type="date" className="form-input" value={endDate} onChange={(e) => setQuery({ endDate: e.target.value, page: 1 })} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.category')}</label>
            <select className="form-select" value={categoryId} onChange={(e) => setQuery({ categoryId: e.target.value, page: 1 })}>
              <option value="">{t('admin_expenses.filter.all')}</option>
              {categories.filter((c) => c?.isActive !== false).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-4 gap-md mt-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.min_amount')}</label>
            <input type="number" className="form-input" value={minAmount} min="0" step="0.01" onChange={(e) => setQuery({ minAmount: e.target.value, page: 1 })} placeholder={t('common.amount_placeholder')} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.max_amount')}</label>
            <input type="number" className="form-input" value={maxAmount} min="0" step="0.01" onChange={(e) => setQuery({ maxAmount: e.target.value, page: 1 })} placeholder={t('common.amount_placeholder')} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.has_receipt')}</label>
            <select className="form-select" value={hasReceipt} onChange={(e) => setQuery({ hasReceipt: e.target.value, page: 1 })}>
              <option value="">{t('admin_expenses.filter.all')}</option>
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.sort_by')}</label>
            <select
              className="form-select"
              value={sortPreset}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'created_asc') setQuery({ sortBy: 'createdAt', sortOrder: 'asc', page: 1 });
                else if (v === 'amount_desc') setQuery({ sortBy: 'amount', sortOrder: 'desc', page: 1 });
                else if (v === 'amount_asc') setQuery({ sortBy: 'amount', sortOrder: 'asc', page: 1 });
                else if (v === 'status_asc') setQuery({ sortBy: 'status', sortOrder: 'asc', page: 1 });
                else if (v === 'status_desc') setQuery({ sortBy: 'status', sortOrder: 'desc', page: 1 });
                else setQuery({ sortBy: 'createdAt', sortOrder: 'desc', page: 1 });
              }}
            >
              <option value="created_desc">{t('common.sort.newest')}</option>
              <option value="created_asc">{t('common.sort.oldest')}</option>
              <option value="amount_desc">{t('common.sort.amount_desc')}</option>
              <option value="amount_asc">{t('common.sort.amount_asc')}</option>
              <option value="status_desc">{t('common.sort.status_desc')}</option>
              <option value="status_asc">{t('common.sort.status_asc')}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-sm mt-md" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAllRowsSelected(!allSelectedOnPage)}
              disabled={loading || bulkLoading || rowIdsOnPage.length === 0}
            >
              {t('common.select_all')}
            </button>
            {selectedIds.length > 0 && (
              <span className="badge badge-neutral">{t('admin_expenses.filters.bulk_selected', { count: selectedIds.length })}</span>
            )}
          </div>

          <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {selectedPendingIds.length > 0 && (
              <>
                <button type="button" className="btn btn-success btn-sm" onClick={handleBulkApprove} disabled={bulkLoading}>
                  {bulkLoading ? <span className="spinner" /> : <CheckCircle size={14} />} {t('admin_expenses.filters.bulk_approve')}
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkRejectOpen} disabled={bulkLoading}>
                  {bulkLoading ? <span className="spinner" /> : <XCircle size={14} />} {t('admin_expenses.filters.bulk_reject')}
                </button>
              </>
            )}
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setQuery({
                  page: 1,
                  status: '',
                  tripSearch: '',
                  categoryId: '',
                  startDate: '',
                  endDate: '',
                  minAmount: '',
                  maxAmount: '',
                  hasReceipt: '',
                  sortBy: '',
                  sortOrder: '',
                  expenseId: '',
                });
              }}
              disabled={!(statusFilter || tripSearch || categoryId || startDate || endDate || minAmount || maxAmount || hasReceipt || sortBy || sortOrder || expenseId)}
            >
              {t('common.filters.clear')}
            </button>
          </div>
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
        <ListLoading />
      ) : loadError ? (
        <ListError
          message={loadError}
          onRetry={load}
          onClearFilters={() => setQuery({
            page: 1,
            status: '',
            tripSearch: '',
            categoryId: '',
            startDate: '',
            endDate: '',
            minAmount: '',
            maxAmount: '',
            hasReceipt: '',
            sortBy: '',
            sortOrder: '',
            expenseId: '',
          })}
        />
      ) : (
        <div className="table-container">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      onChange={(e) => setAllRowsSelected(Boolean(e.target.checked))}
                      disabled={loading || bulkLoading || rowIdsOnPage.length === 0}
                      checked={allSelectedOnPage}
                      aria-label={t('common.select_all')}
                    />
                  </th>
                  <th>{t('admin_expenses.table.driver')}</th>
                  <th>{t('admin_expenses.table.category')}</th>
                  <th>{t('admin_expenses.table.trip')}</th>
                  <th>{t('admin_expenses.table.amount')}</th>
                  <th>{t('admin_expenses.table.description')}</th>
                  <th>{t('admin_expenses.table.status')}</th>
                  <th>{t('admin_expenses.table.date')}</th>
                  <th>{t('admin_expenses.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={9} className="empty-state">{t('admin_expenses.table.empty')}</td></tr>
                ) : expenses.map(e => {
                  const isSelected = selectedIds.includes(String(e.id));
                  const sKey = statusKey(e.status);
                  const isReviewing = reviewingIds.has(String(e.id));
                  return (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={bulkLoading}
                          onClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => {
                            ev.stopPropagation();
                            setRowSelected(e.id, Boolean(ev.target.checked));
                          }}
                          aria-label={t('common.select')}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{e.driver?.name || '—'}</td>
                      <td>{e.category?.name || '—'}</td>
                      <td className="text-sm">
                        <div className="flex items-center gap-sm" style={{ justifyContent: 'space-between' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                            {e.trip ? `${e.trip.pickupLocation} -> ${e.trip.dropoffLocation}` : '—'}
                          </span>
                          {e.receiptUrl && (
                            <button
                              type="button"
                              className="btn-icon"
                              title={t('admin_expenses.modal.receipt')}
                              onClick={() => window.open(e.receiptUrl, '_blank', 'noopener,noreferrer')}
                            >
                              <Receipt size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{numberFmt.format(parseFloat(e.amount || 0))} {t('common.currency')}</td>
                      <td className="text-sm">{e.description || '—'}</td>
                      <td><span className={`badge badge-status ${STATUS_BADGES[sKey] ?? STATUS_BADGES.DEFAULT}`}>{t(`common.status.${sKey}`)}</span></td>
                      <td className="text-sm text-muted">{formatDate(e.createdAt)}</td>
                      <td>
                        <div className="flex gap-sm">
                          <button className="btn-icon" onClick={() => setSelected(e)} title={t('common.view')} disabled={bulkLoading || isReviewing}><Eye size={16} /></button>
                          {sKey === 'pending' && (
                            <>
                              <button
                                className="btn-icon"
                                onClick={() => handleReview(e.id, 'approved')}
                                style={{ color: 'var(--color-success)' }}
                                title={t('admin_expenses.modal.approve')}
                                disabled={bulkLoading || isReviewing}
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleReview(e.id, 'rejected')}
                                style={{ color: 'var(--color-danger)' }}
                                title={t('admin_expenses.modal.reject')}
                                disabled={bulkLoading || isReviewing}
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={(p) => setQuery({ page: p })}
        pageSize={limit}
        onPageSizeChange={(size) => setQuery({ limit: size, page: 1 })}
      />

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
                {
                  label: t('admin_expenses.table.trip'),
                  value: selected.trip
                    ? `${selected.trip.pickupLocation} -> ${selected.trip.dropoffLocation}`
                    : '—'
                },
                { label: t('admin_expenses.table.amount'), value: `${numberFmt.format(parseFloat(selected.amount || 0))} ${t('common.currency')}` },
                { label: t('admin_expenses.table.date'), value: formatDate(selected.createdAt) },
                {
                  label: t('admin_expenses.table.status'),
                  value: t(`common.status.${statusKey(selected.status)}`),
                  type: 'badge',
                  badgeClass: STATUS_BADGES[statusKey(selected.status)] ?? STATUS_BADGES.DEFAULT
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
          actions={statusKey(selected.status) === 'pending' && (
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
        onClose={() => setPromptData({ isOpen: false, expenseId: null, expenseIds: null })}
        onConfirm={(reason) => {
          if (promptData.expenseId) return handleReview(promptData.expenseId, 'rejected', reason);
          if (Array.isArray(promptData.expenseIds) && promptData.expenseIds.length) return handleBulkReject(reason);
          return undefined;
        }}
        title={t('admin_expenses.modal.reject')}
        message={t('admin_expenses.modal.reject_prompt')}
        placeholder={t('admin_expenses.modal.reason_placeholder')}
      />
    </div>
  );
}
