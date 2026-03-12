import { useEffect, useState, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { ToastContext } from '../../contexts/toastContext';
import { useAuth } from '../../hooks/useAuth';

export default function AdminProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useContext(ToastContext);
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const loadProfile = useCallback(async (silent = false) => {
    setLoading(true);
    try {
      const res = await authService.getMe();
      const me = res?.data?.user || user;
      setForm({
        name: me?.name || '',
        email: me?.email || '',
        phone: me?.phone || '',
      });
    } catch (err) {
      if (!silent) {
        addToast(err.message || t('common.error'), 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [addToast, t, user]);

  useEffect(() => {
    loadProfile(false);
  }, [loadProfile]);

  useEffect(() => {
    const handleRealtimeUpdate = () => loadProfile(true);
    window.addEventListener('ws:update', handleRealtimeUpdate);
    window.addEventListener('online', handleRealtimeUpdate);
    return () => {
      window.removeEventListener('ws:update', handleRealtimeUpdate);
      window.removeEventListener('online', handleRealtimeUpdate);
    };
  }, [loadProfile]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      const res = await authService.updateMe(payload);
      if (res?.data?.user) {
        updateUser(res.data.user);
      }
      addToast(t('admin_profile.messages.updated'), 'success');
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin_profile.title')}</h1>
          <p className="page-subtitle">{t('admin_profile.subtitle')}</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '680px' }}>
        <form onSubmit={handleSubmit} className="form-stack" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label className="form-label">{t('auth.name')}</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('common.full_name_placeholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder={t('common.email_placeholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('common.phone')}</label>
            <input
              type="text"
              className="form-input"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder={t('common.phone')}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/change-password')}>
              {t('auth.change_password')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
