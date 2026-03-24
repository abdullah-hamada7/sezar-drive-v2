import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { driverService as api } from '../../services/driver.service';
import { ToastContext } from '../../contexts/toastContext';
import { Plus, Search, Edit, Trash2, X, UserCheck, UserX, Download } from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import { EMAIL_REGEX, EGYPT_PHONE_REGEX } from '../../utils/validation';
import Pagination from '../../components/common/Pagination';
import { ListError, ListLoading } from '../../components/common/ListStates';
import { downloadApiFile } from '../../utils/download';

export default function DriversPage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || '15', 10) || 15;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams]);
  const search = useMemo(() => String(searchParams.get('search') || ''), [searchParams]);
  const statusFilter = useMemo(() => String(searchParams.get('status') || 'active'), [searchParams]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === false) next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [drivers, setDrivers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', licenseNumber: '', password: '' });
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmData, setConfirmData] = useState({ isOpen: false, type: '', data: null });
  const [exporting, setExporting] = useState(false);

  const validateField = (name, value) => {
    let err = '';
    if (name === 'phone') {
      if (!value) err = t('drivers.modal.phone_required');
      else if (!EGYPT_PHONE_REGEX.test(value)) err = t('drivers.modal.phone_invalid');
    }
    if (name === 'email') {
      if (!value) err = t('drivers.modal.email_required');
      else if (!EMAIL_REGEX.test(value)) err = t('drivers.modal.email_invalid');
    }
    if (name === 'licenseNumber') {
      if (!value) err = t('drivers.modal.license_required');
      else if (!/^[A-Z0-9-]+$/i.test(value)) err = t('drivers.modal.license_invalid');
    }
    if (name === 'name' && !value) err = t('drivers.modal.name_required');
    if (name === 'password') {
      if (!editDriver && !value) err = t('drivers.modal.password_invalid');
      if (value && value.length < 8) err = t('drivers.modal.password_invalid');
    }

    setFieldErrors(prev => ({ ...prev, [name]: err }));
    return !err;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ page, limit, status: statusFilter });
      if (search) params.set('search', search);
      const res = await api.getDrivers(params.toString());
      setDrivers(res.data.drivers || []);
      setPagination(res.data || {});
    } catch (err) {
      console.error(err);
      const msg = err?.message || t('common.error');
      setLoadError(msg);
      addToast(msg, 'error');
    }
    finally { setLoading(false); }
  }, [addToast, limit, page, search, statusFilter, t]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ search, status: statusFilter });
      await downloadApiFile({
        endpoint: `/drivers/export?${params.toString()}`,
        filename: `drivers-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleUpdate = () => load();
    window.addEventListener('ws:identity_reviewed', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    return () => {
      window.removeEventListener('ws:identity_reviewed', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
    };
  }, [load]);

  function openCreate() {
    setEditDriver(null);
    setForm({ name: '', email: '', phone: '', licenseNumber: '', password: '' });
    setFiles({});
    setPreviews({});
    setFieldErrors({});
    setSubmitError('');
    setShowModal(true);
  }

  function openEdit(driver) {
    setEditDriver(driver);
    setForm({ name: driver.name, email: driver.email, phone: driver.phone, licenseNumber: driver.licenseNumber || '' });
    setFiles({});
    setPreviews({
      avatar: driver.avatarUrl || driver.profilePhotoUrl,
      idCardFront: driver.idCardFront,
      idCardBack: driver.idCardBack
    });
    setFieldErrors({});
    setSubmitError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError('');

    // Final check
    const isNameValid = validateField('name', form.name);
    const isEmailValid = validateField('email', form.email);
    const isPhoneValid = validateField('phone', form.phone);
    const isLicenseValid = validateField('licenseNumber', form.licenseNumber);
    const isPasswordValid = editDriver ? true : validateField('password', form.password);

    if (!isNameValid || !isEmailValid || !isPhoneValid || !isLicenseValid || !isPasswordValid) {
      setSubmitError(t('drivers.messages.check_fields'));
      return;
    }

    if (!editDriver) {
      const missingPhotos = {
        avatar: !files.avatar,
        idCardFront: !files.idCardFront,
        idCardBack: !files.idCardBack,
      };

      if (missingPhotos.avatar || missingPhotos.idCardFront || missingPhotos.idCardBack) {
        setFieldErrors(prev => ({
          ...prev,
          avatar: missingPhotos.avatar ? t('drivers.modal.photo_required') : '',
          idCardFront: missingPhotos.idCardFront ? t('drivers.modal.photo_required') : '',
          idCardBack: missingPhotos.idCardBack ? t('drivers.modal.photo_required') : '',
        }));
        setSubmitError(t('drivers.modal.required_photos_error'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('phone', form.phone);
      if (form.licenseNumber) formData.append('licenseNumber', form.licenseNumber);
      if (form.password) formData.append('password', form.password);

      if (files.avatar) formData.append('avatar', files.avatar);
      if (files.idCardFront) formData.append('idCardFront', files.idCardFront);
      if (files.idCardBack) formData.append('idCardBack', files.idCardBack);

      if (editDriver) {
        const res = await api.updateDriver(editDriver.id, formData);
        if (res?.queued) {
          addToast(t('common.offline.saved_will_sync'), 'info');
        } else {
          addToast(t('common.success'), 'success');
        }
      } else {
        formData.append('email', form.email);
        const res = await api.createDriver(formData);
        if (res?.queued) {
          addToast(t('common.offline.saved_will_sync'), 'info');
        } else {
          addToast(t('common.success'), 'success');
        }
      }
      setShowModal(false);
      await load();
    } catch (err) {
      if (Array.isArray(err?.details) && err.details.length > 0) {
        const backendErrs = {};
        err.details.forEach((d) => {
          const key = d?.path || d?.param;
          if (!key) return;
          backendErrs[key] = d?.msg || t('common.error');
        });
        setFieldErrors((prev) => ({ ...prev, ...backendErrs }));
        setSubmitError(t('drivers.messages.validation_failed'));
        addToast(t('drivers.messages.validation_failed'), 'error');
      } else {
        const code = err?.code;
        const translated = code ? t(`errors.${code}`) : '';
        const msg = (translated && translated !== `errors.${code}`)
          ? translated
          : (err?.message || t('drivers.messages.op_failed'));
        setSubmitError(msg);
        addToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setConfirmData({ isOpen: true, type: 'delete', data: { id } });
  }

  async function handleApprove(driver) {
    setConfirmData({ isOpen: true, type: 'approve', data: { id: driver.id, name: driver.name } });
  }

  async function onConfirmAction() {
    const { type, data } = confirmData;
    try {
      if (type === 'delete') {
        await api.deleteDriver(data.id);
      } else if (type === 'permanentDelete') {
        await api.deleteDriverPermanently(data.id);
      } else if (type === 'approve') {
        await api.reviewIdentity(data.id, { action: 'approve' });
      } else if (type === 'reactivate') {
        await api.reactivateDriver(data.id);
        addToast(t('drivers.messages.updated'), 'success');
      }
      load();
    } catch (err) {
      const msg = err.errorCode ? t(`errors.${err.errorCode}`) : (err.message || t('common.error'));
      addToast(msg, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('drivers.title')}</h1>
          <p className="page-subtitle">{t('drivers.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <Download size={18} />} {t('common.export_csv')}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> {t('drivers.add_btn')}
          </button>
        </div>
      </div>

      <div className="card mb-md">
        <div className="flex items-center gap-md">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            className="form-input"
            placeholder={t('drivers.search_placeholder')}
            value={search}
            onChange={(e) => setQuery({ search: e.target.value, page: 1 })}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.25rem' }}
          />
        </div>
      </div>

      <div className="card p-sm mb-md flex gap-sm" style={{ overflowX: 'auto' }}>
        {['active', 'inactive', 'all'].map(filter => (
          <button
            key={filter}
            className={`btn btn-sm ${statusFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setQuery({ status: filter, page: 1 })}
          >
            {filter === 'active'
              ? t('drivers.filters.active')
              : filter === 'inactive'
                ? t('drivers.filters.archived')
                : t('drivers.filters.all')}
          </button>
        ))}
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('drivers.title')}</span>
            </div>
            <span className="badge badge-info">{drivers.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <ListLoading />
      ) : loadError ? (
        <ListError
          message={loadError}
          onRetry={load}
          onClearFilters={() => setQuery({ search: '', status: 'active', page: 1 })}
        />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('drivers.table.name')}</th>
                <th>{t('drivers.table.email')}</th>
                <th>{t('drivers.table.phone')}</th>
                <th>{t('drivers.table.license')}</th>
                <th>{t('drivers.table.status')}</th>
                <th>{t('drivers.table.identity')}</th>
                <th>{t('drivers.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">{t('drivers.table.empty')}</td></tr>
              ) : drivers.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td>{d.email}</td>
                  <td>{d.phone}</td>
                  <td>{d.licenseNumber || '—'}</td>
                  <td>
                    <span className={`badge badge-status ${d.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {d.isActive ? t('drivers.table.active') : t('drivers.table.inactive')}
                    </span>
                  </td>
                  <td>
                    {d.identityVerified
                      ? <span className="badge badge-status badge-success"><UserCheck size={12} /> {t('common.shift_verification_status.verified')}</span>
                      : <span className="badge badge-status badge-warning"><UserX size={12} /> {t('common.shift_verification_status.pending')}</span>
                    }
                  </td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => openEdit(d)} title={t('common.edit')}>
                        <Edit size={16} />
                      </button>
                      {!d.identityVerified && (
                        <button
                          className="btn-icon text-success"
                          onClick={() => handleApprove(d)}
                          title={t('nav.verification')}
                        >
                          <UserCheck size={16} />
                        </button>
                      )}
                      {d.isActive ? (
                        <button
                          className="btn-icon text-danger"
                          onClick={() => handleDelete(d.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setConfirmData({ isOpen: true, type: 'reactivate', data: { id: d.id, name: d.name } })}
                          >
                            {t('drivers.actions.reactivate')}
                          </button>
                          <button
                            className="btn-icon text-danger"
                            onClick={() => setConfirmData({ isOpen: true, type: 'permanentDelete', data: { id: d.id, name: d.name } })}
                            title={t('drivers.actions.delete_permanently')}
                          >
                            <Trash2 size={16} />
                          </button>
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

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={(nextPage) => setQuery({ page: nextPage })}
        pageSize={limit}
        onPageSizeChange={(nextLimit) => setQuery({ limit: nextLimit, page: 1 })}
      />

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editDriver ? t('drivers.modal.edit_title') : t('drivers.modal.add_title')}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {submitError && (
                <div className="alert alert-danger mb-md">
                  {submitError}
                </div>
              )}
              <div className="form-section mb-md">
                <label className="form-label mb-sm" style={{ display: 'block' }}>{t('drivers.modal.photos_section')}</label>
                <div className="grid grid-3 gap-md">
                  {['avatar', 'idCardFront', 'idCardBack'].map(key => (
                    <div key={key} className="text-center">
                      <label className="block text-xs font-semibold mb-xs uppercase opacity-70">{t(`drivers.modal.${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`)}</label>
                      <div
                        onClick={() => document.getElementById(`file-${key}`).click()}
                        style={{
                          width: '100%', aspectRatio: '4/3',
                          background: 'var(--color-bg-tertiary)', borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', overflow: 'hidden', border: '1px dashed var(--color-border-light)'
                        }}
                      >
                        {previews[key] ? (
                          <img src={previews[key]} alt={key} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div className="flex flex-col items-center gap-xs">
                            <Plus size={20} className="text-muted" />
                            <span className="text-xs text-muted">{t('drivers.modal.tap_upload')}</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        id={`file-${key}`}
                        hidden
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files[0];
                          if (file) {
                            setFiles(prev => ({ ...prev, [key]: file }));
                            setPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
                            setFieldErrors(prev => ({ ...prev, [key]: '' }));
                          }
                        }}
                      />
                      {!editDriver && fieldErrors[key] && <span className="text-xs text-danger">{fieldErrors[key]}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div className="form-group">
                  <label className="form-label">{t('drivers.modal.name_label')}</label>
                  <input
                    className={`form-input ${fieldErrors.name ? 'border-danger' : ''}`}
                    name="name"
                    placeholder={t('common.full_name_placeholder')}
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); validateField('name', e.target.value); }}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                  {fieldErrors.name && <span className="text-xs text-danger">{fieldErrors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('drivers.modal.email_label')}</label>
                  <input
                    type="email"
                    className={`form-input ${fieldErrors.email ? 'border-danger' : ''}`}
                    name="email"
                    placeholder={t('common.email_placeholder')}
                    value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); validateField('email', e.target.value); }}
                    required
                    disabled={!!editDriver}
                    maxLength={150}
                  />
                  {fieldErrors.email && <span className="text-xs text-danger">{fieldErrors.email}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('drivers.modal.phone_label')}</label>
                  <input
                    className={`form-input ${fieldErrors.phone ? 'border-danger' : ''}`}
                    name="phone"
                    value={form.phone}
                    onChange={e => {
                      const val = e.target.value.replace(/[^\d+]/g, '');
                      setForm({ ...form, phone: val });
                      validateField('phone', val);
                    }}
                    required
                    placeholder={t('drivers.modal.phone_placeholder')}
                    type="tel"
                    pattern="^(?:\+201[0125]\d{8}|01[0125]\d{8})$"
                  />
                  {fieldErrors.phone && <span className="text-xs text-danger">{fieldErrors.phone}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('drivers.modal.license_label')}</label>
                  <input
                    className={`form-input ${fieldErrors.licenseNumber ? 'border-danger' : ''}`}
                    name="licenseNumber"
                    value={form.licenseNumber}
                    onChange={e => {
                      const val = e.target.value.toUpperCase(); // Preach uppercase
                      setForm({ ...form, licenseNumber: val });
                      validateField('licenseNumber', val);
                    }}
                    placeholder={t('drivers.modal.license_placeholder')}
                    minLength={2}
                    maxLength={50}
                  />
                  {fieldErrors.licenseNumber && <span className="text-xs text-danger">{fieldErrors.licenseNumber}</span>}
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">
                    {t('drivers.modal.password_label')} {editDriver && t('drivers.modal.password_keep')} {!editDriver && '*'}
                  </label>
                  <input
                    className={`form-input ${fieldErrors.password ? 'border-danger' : ''}`}
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); validateField('password', e.target.value); }}
                    required={!editDriver}
                    placeholder={t('drivers.modal.password_hint')}
                    minLength={8}
                    maxLength={100}
                  />
                  {fieldErrors.password && <span className="text-xs text-danger">{fieldErrors.password}</span>}
                </div>
              </div>
              {!editDriver && (
                <div className="alert alert-info" style={{ marginTop: '0.5rem' }}>
                  {t('drivers.modal.first_login_alert')}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting}>
                  {submitting ? <span className="spinner" /> : null}{' '}
                  {editDriver ? t('drivers.modal.update_btn') : t('drivers.modal.create_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData({ isOpen: false, type: '', data: null })}
        onConfirm={onConfirmAction}
        title={
          confirmData.type === 'delete' ? t('common.delete')
            : confirmData.type === 'reactivate' ? t('common.actions.reactivate')
              : confirmData.type === 'permanentDelete' ? t('drivers.actions.delete_permanently')
              : t('common.shift_verification_status.verified')
        }
        message={
          confirmData.type === 'delete' ? t('drivers.messages.delete_confirm')
            : confirmData.type === 'reactivate' ? t('drivers.messages.reactivate_confirm', { name: confirmData.data?.name })
              : confirmData.type === 'permanentDelete' ? t('drivers.messages.permanent_delete_confirm', { name: confirmData.data?.name })
              : t('drivers.messages.approve_confirm', { name: confirmData.data?.name })
        }
        variant={confirmData.type === 'delete' || confirmData.type === 'permanentDelete' ? 'danger' : 'success'}
      />
    </div>
  );
}
