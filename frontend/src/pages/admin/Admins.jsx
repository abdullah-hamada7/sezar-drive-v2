import { useEffect, useState, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '../../services/admin.service';
import { ToastContext } from '../../contexts/toastContext';
import { Trash2, XCircle, Search, ShieldAlert, ShieldCheck, Plus, RefreshCw } from 'lucide-react';
import PromptModal from '../../components/common/PromptModal';

export default function AdminsPage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', temporaryPassword: '', adminRole: 'ADMIN' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [promptData, setPromptData] = useState({ isOpen: false, adminId: null, actionType: null });
  const [resetPrompt, setResetPrompt] = useState({ isOpen: false, adminId: null });

  const load = useCallback(async () => {
    setLoading(true);
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
    setIsSubmitting(true);
    try {
      if (form.temporaryPassword && form.temporaryPassword.length < 8) {
        addToast(t('admins_page.messages.password_min'), 'error');
        setIsSubmitting(false);
        return;
      }
      if (!/^\+?[0-9]{10,15}$/.test(form.phone)) {
        addToast(t('admins_page.messages.phone_invalid'), 'error');
        setIsSubmitting(false);
        return;
      }
      await adminService.createAdmin(form);
      addToast(t('admins_page.messages.created'), 'success');
      closeModal();
      load();
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setForm({ name: '', email: '', phone: '', temporaryPassword: '', adminRole: 'ADMIN' });
  }

  async function onConfirmAction() {
    try {
      if (promptData.actionType === 'reactivate') {
        await adminService.reactivateAdmin(promptData.adminId);
        addToast(t('admins_page.messages.reactivated'), 'success');
      } else {
        await adminService.deactivateAdmin(promptData.adminId);
        addToast(t('admins_page.messages.deactivated'), 'success');
      }
      load();
    } catch (err) {
      if (err.data?.code === 'CANNOT_DELETE_SELF') {
        addToast(t('admins_page.messages.cannot_deactivate_self'), 'warning');
      } else {
        addToast(err.message || t('common.error'), 'error');
      }
    }
  }

  async function onConfirmResetPassword(temporaryPassword) {
    try {
      await adminService.resetAdminPassword(resetPrompt.adminId, temporaryPassword);
      addToast(t('admins_page.messages.password_reset'), 'success');
      setResetPrompt({ isOpen: false, adminId: null });
    } catch (err) {
      const errorCode = err?.data?.error?.code || err?.data?.code || err?.code;
      if (errorCode === 'CANNOT_RESET_SELF') {
        addToast(t('admins_page.messages.cannot_reset_self'), 'warning');
      } else {
        addToast(err?.data?.error?.message || err?.message || t('common.error'), 'error');
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.admins') || 'Admins'}</h1>
          <p className="page-subtitle">{t('admins_page.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> {t('admins_page.create_btn')}
        </button>
      </div>

      <div className="card mb-md flex items-center justify-between gap-sm" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="flex items-center gap-sm flex-1" style={{ minWidth: 0 }}>
          <Search size={16} className="text-muted" />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', minWidth: '220px' }}
            placeholder={t('admins_page.search_placeholder')}
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
                <th>{t('admins_page.table.role')}</th>
                <th>{t('admins_page.table.status')}</th>
                <th>{t('admins_page.table.created')}</th>
                <th>{t('admins_page.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">{t('admins_page.table.empty')}</td></tr>
              ) : admins.map(a => (
                <tr key={a.id}>
                  <td className="font-bold">{a.name}</td>
                  <td className="text-muted">{a.email}</td>
                  <td>
                    {a.adminRole === 'SUPER_ADMIN' ? (
                      <span className="badge badge-warning flex items-center gap-xs" style={{ width: 'fit-content' }}><ShieldAlert size={12} /> {t('admins_page.roles.super_admin')}</span>
                    ) : (
                      <span className="badge badge-info flex items-center gap-xs" style={{ width: 'fit-content' }}><ShieldCheck size={12} /> {t('admins_page.roles.system_admin')}</span>
                    )}
                  </td>
                  <td>
                    {a.isActive ? (
                      <span className="badge badge-success">{t('common.status.active')}</span>
                    ) : (
                      <span className="badge badge-danger">{t('common.status.inactive')}</span>
                    )}
                  </td>
                  <td className="text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button
                        className="btn-icon text-warning"
                        onClick={() => setResetPrompt({ isOpen: true, adminId: a.id })}
                        title={t('admins_page.actions.reset_password')}
                      >
                        <RefreshCw size={16} />
                      </button>
                      {a.isActive ? (
                        <button className="btn-icon text-danger" onClick={() => setPromptData({ isOpen: true, adminId: a.id, actionType: 'deactivate' })} title={t('admins_page.actions.deactivate')}><Trash2 size={16} /></button>
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
              <h2 className="modal-title">{t('admins_page.modal.title')}</h2>
              <button className="btn-icon" onClick={closeModal}><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="grid grid-2 gap-md mb-md">
                <div className="form-group">
                  <label className="form-label">{t('auth.name')}</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={100} placeholder={t('common.full_name_placeholder')} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('auth.email')}</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required maxLength={150} placeholder={t('common.email_placeholder')} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('admins_page.modal.phone')}</label>
                  <input type="tel" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required placeholder={t('admins_page.modal.phone_placeholder')} pattern="^\+?[0-9]{10,15}$" />
                </div>
              </div>

              <div className="grid grid-2 gap-md mb-lg">
                <div className="form-group">
                  <label className="form-label">{t('admins_page.modal.role_config')}</label>
                  <select className="form-input" value={form.adminRole} onChange={e => setForm({ ...form, adminRole: e.target.value })}>
                    <option value="ADMIN">{t('admins_page.roles.system_admin')}</option>
                    <option value="SUPER_ADMIN">{t('admins_page.roles.super_admin_full')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('admins_page.modal.temporary_password')}</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder={t('admins_page.modal.temporary_password_placeholder')}
                    value={form.temporaryPassword}
                    onChange={e => setForm({ ...form, temporaryPassword: e.target.value })}
                    required
                    minLength={8}
                    maxLength={100}
                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
                  />
                  <div className="text-xs text-muted mt-xs">{t('admins_page.modal.password_hint')}</div>
                </div>
              </div>

              <div className="modal-actions mt-xl pt-md border-t border-subtle">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? t('auth.login_progress') : t('admins_page.create_btn')}
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
        title={promptData.actionType === 'reactivate' ? t('admins_page.prompt.reactivate_title') : t('admins_page.prompt.deactivate_title')}
        message={promptData.actionType === 'reactivate' ? t('admins_page.prompt.reactivate_message') : t('admins_page.prompt.deactivate_message')}
        placeholder={promptData.actionType === 'reactivate' ? t('admins_page.prompt.reactivate_placeholder') : t('admins_page.prompt.deactivate_placeholder')}
      />

      <PromptModal
        isOpen={resetPrompt.isOpen}
        onClose={() => setResetPrompt({ isOpen: false, adminId: null })}
        onConfirm={onConfirmResetPassword}
        title={t('admins_page.prompt.reset_password_title')}
        message={t('admins_page.prompt.reset_password_message')}
        placeholder={t('admins_page.prompt.reset_password_placeholder')}
        confirmText={t('admins_page.actions.reset_password')}
      />
    </div>
  );
}
