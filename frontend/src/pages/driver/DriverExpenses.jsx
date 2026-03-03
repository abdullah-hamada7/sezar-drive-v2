import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { expenseService as api } from '../../services/expense.service';
import { Receipt, Plus, X, Upload, CheckCircle } from 'lucide-react';
import { useShift } from '../../contexts/ShiftContext';
import { ToastContext } from '../../contexts/toastContext';

const STATUS_BADGES = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };

export default function DriverExpenses() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const { activeShift } = useShift();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ categoryId: '', amount: '', description: '', receipt: null });

  useEffect(() => { load(); loadCategories(); }, []);

  useEffect(() => {
    const handleUpdate = () => {
      load();
    };

    window.addEventListener('ws:expense_update', handleUpdate);
    return () => {
      window.removeEventListener('ws:expense_update', handleUpdate);
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getExpenses('limit=20');
      setExpenses(res.data.expenses || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadCategories() {
    try {
      const res = await api.getExpenseCategories();
      setCategories(res.data || []);
    } catch { /* ignore */ }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!activeShift) {
      addToast(t('expenses.error_shift'), 'error');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('shiftId', activeShift.id);
      formData.append('categoryId', form.categoryId);
      formData.append('amount', form.amount);
      formData.append('description', form.description);
      if (form.receipt) formData.append('receipt', form.receipt);

      await api.createExpense(formData);
      setShowForm(false);
      setForm({ categoryId: '', amount: '', description: '', receipt: null });
      addToast(t('expenses.success_create'), 'success');
      load();
    } catch (err) {
      const code = err.errorCode || err.code;
      // If code is present, HttpService/App.jsx might already handle it, 
      // but we ensure it's translated here if needed.
      if (code) addToast(t(`errors.${code}`), 'error');
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <h2 className="page-title">{t('expenses.title')}</h2>
        <button className="btn btn-primary btn-sm flex items-center gap-xs" onClick={() => setShowForm(true)}>
          <Plus size={16} /> {t('expenses.new')}
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="card empty-state">
          <Receipt size={40} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
          <p>{t('expenses.no_expenses')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {expenses.map(e => (
            <div key={e.id} className="card" style={{ padding: 'var(--space-md)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-xs)' }}>
                <span className="text-sm" style={{ fontWeight: 600 }}>{e.category?.name || t('nav.expenses')}</span>
                <span className={`badge ${STATUS_BADGES[e.status]}`}>{t(`expenses.status.${e.status}`)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{e.description || '—'}</span>
                <span className="font-bold">{parseFloat(e.amount).toFixed(2)} {t('trip.price_unit')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">{t('expenses.submit_title')}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group mb-md">
                <label className="form-label">{t('expenses.category_label')}</label>
                <select className="form-select" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">{t('expenses.select_category')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="row">
                <div className="col form-group mb-md">
                  <label className="form-label">{t('expenses.amount_label')}</label>
                  <input type="number" step="0.01" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required placeholder="0.00" />
                </div>
              </div>
              <div className="form-group mb-md">
                <label className="form-label">{t('expenses.description_label')}</label>
                <textarea className="form-textarea" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('expenses.placeholder_desc')} />
              </div>
              <div className="form-group mb-lg">
                <label className="form-label">{t('expenses.receipt_label')}</label>
                <div className="flex items-center gap-md">
                  <label className="file-upload-zone" style={{ flex: 1 }}>
                    <input type="file" style={{ display: 'none' }} onChange={e => setForm({ ...form, receipt: e.target.files[0] })} accept="image/*" />
                    <div className="flex flex-col items-center gap-xs">
                      {form.receipt ? <CheckCircle className="text-success" size={24} /> : <Upload size={24} className="text-muted" />}
                      <span className="text-xs">{form.receipt ? form.receipt.name : t('driver_home.tap_select')}</span>
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-actions gap-sm">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary flex-1">{t('expenses.submit_title')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
