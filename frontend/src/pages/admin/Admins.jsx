import { useEffect, useState, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '../../services/admin.service';
import { ToastContext } from '../../contexts/toastContext';
import { Trash2, XCircle, Search, ShieldAlert, ShieldCheck, Plus } from 'lucide-react';
import PromptModal from '../../components/common/PromptModal';

export default function AdminsPage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', temporaryPassword: '', adminRole: 'SYSTEM_ADMIN' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [promptData, setPromptData] = useState({ isOpen: false, adminId: null, actionType: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page, limit: 10 });
      if (searchTerm) qs.append('search', searchTerm);

      // Optionally modify getAdmins to return ALL admins if a super admin requests it, 
      // but assuming for now getAdmins returns all based on business requirements.
      const res = await adminService.getAdmins(qs.toString());
      setAdmins(res.data.admins || []);
      setPagination(res.data);
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, addToast, t]);

  useEffect(() => { load(); }, [load]);

  function applySearch() {
    setPage(1);
    setSearchTerm(searchInput.trim());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (form.temporaryPassword && form.temporaryPassword.length < 8) {
        setError('Password must be at least 8 characters');
        setIsSubmitting(false);
        return;
      }
      await adminService.createAdmin(form);
      addToast('Admin created successfully', 'success');
      closeModal();
      load();
    } catch (err) {
      if (err.data && err.data.code === 'USER_ALREADY_EXISTS') {
        setError('Admin with this email already exists.');
      } else if (err.data && err.data.code === 'USER_DEACTIVATED') {
        setError(err.data.message);
      } else {
        setError(err.message || 'An error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setForm({ name: '', email: '', temporaryPassword: '', adminRole: 'SYSTEM_ADMIN' });
    setError(null);
  }

  async function onConfirmAction() {
    try {
      if (promptData.actionType === 'reactivate') {
        await adminService.reactivateAdmin(promptData.adminId);
        addToast('Admin reactivated successfully', 'success');
      } else {
        await adminService.deactivateAdmin(promptData.adminId);
        addToast('Admin deactivated successfully', 'success');
      }
      load();
    } catch (err) {
      if (err.data?.code === 'CANNOT_DELETE_SELF') {
        addToast('You cannot deactivate yourself.', 'warning');
      } else {
        addToast(err.message || t('common.error'), 'error');
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.admins') || 'Admins'}</h1>
          <p className="page-subtitle">Manage system administrators across the business.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Create Admin
        </button>
      </div>

      <div className="card mb-md flex items-center justify-between" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="flex items-center gap-sm">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            className="input flex-1"
            style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: 0 }}
            placeholder={t('common.search')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
          />
        </div>
        <button className="btn btn-sm btn-secondary" onClick={applySearch}>{t('common.search')}</button>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner"></div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('auth.name')}</th>
                <th>{t('auth.email')}</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No administrators found</td></tr>
              ) : admins.map(a => (
                <tr key={a.id}>
                  <td className="font-bold">{a.name}</td>
                  <td className="text-muted">{a.email}</td>
                  <td>
                    {a.adminRole === 'SUPER_ADMIN' ? (
                      <span className="badge badge-warning flex items-center gap-xs" style={{ width: 'fit-content' }}><ShieldAlert size={12} /> Super Admin</span>
                    ) : (
                      <span className="badge badge-info flex items-center gap-xs" style={{ width: 'fit-content' }}><ShieldCheck size={12} /> System Admin</span>
                    )}
                  </td>
                  <td>
                    {a.isActive ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Inactive</span>
                    )}
                  </td>
                  <td className="text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-sm">
                      {a.isActive ? (
                        <button className="btn-icon text-danger" onClick={() => setPromptData({ isOpen: true, adminId: a.id, actionType: 'deactivate' })} title="Deactivate"><Trash2 size={16} /></button>
                      ) : (
                        <button className="btn btn-sm btn-secondary" onClick={() => setPromptData({ isOpen: true, adminId: a.id, actionType: 'reactivate' })}>{t('common.actions.reactivate')}</button>
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
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>{t('common.pagination.prev')}</button>
          <span className="text-sm text-muted">
            {t('common.pagination.info', { current: page, total: pagination.totalPages })}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>{t('common.pagination.next')}</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create System Admin</h2>
              <button className="btn-icon" onClick={closeModal}><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="grid grid-2 gap-md mb-md">
                <div className="form-group">
                  <label className="form-label">{t('auth.name')}</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={100} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('auth.email')}</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required maxLength={150} />
                </div>
              </div>

              <div className="grid grid-2 gap-md mb-lg">
                <div className="form-group">
                  <label className="form-label">Role Configuration</label>
                  <select className="form-input" value={form.adminRole} onChange={e => setForm({ ...form, adminRole: e.target.value })}>
                    <option value="SYSTEM_ADMIN">System Admin</option>
                    <option value="SUPER_ADMIN">Super Admin (Highest Privilege)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Temporary Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Must be changed on login"
                    value={form.temporaryPassword}
                    onChange={e => setForm({ ...form, temporaryPassword: e.target.value })}
                    required
                    minLength={8}
                    maxLength={100}
                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
                  />
                  <div className="text-xs text-muted mt-xs">Required: 1 uppercase, 1 number, 8 chars min.</div>
                </div>
              </div>

              <div className="modal-actions mt-xl pt-md border-t border-subtle">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? t('auth.login_progress') : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PromptModal
        isOpen={promptData.isOpen}
        onClose={() => setPromptData({ isOpen: false, adminId: null, actionType: null })}
        onConfirm={onConfirmAction}
        title={promptData.actionType === 'reactivate' ? "Reactivate Admin" : "Deactivate Admin"}
        message={promptData.actionType === 'reactivate' ? "Are you sure you want to restore this administrator's access?" : "Are you sure you want to deactivate this system administrator?"}
        placeholder={promptData.actionType === 'reactivate' ? "Type 'REACTIVATE' to confirm" : "Type 'DEACTIVATE' to confirm"}
      />
    </div>
  );
}
