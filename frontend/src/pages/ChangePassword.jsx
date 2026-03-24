import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ToastContext } from '../contexts/toastContext';
import { useAuth } from '../hooks/useAuth';
import { authService as api } from '../services/auth.service';
import { http } from '../services/http.service';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import BrandIcon from '../components/BrandIcon';
import './Login.css';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useContext(ToastContext);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      addToast(t('auth.passwords_dont_match'), 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast(t('drivers.modal.password_invalid'), 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({ currentPassword, newPassword });
      const { user: updatedUser, accessToken } = res.data;

      if (accessToken) {
        http.setTokens(accessToken);
        updateUser(updatedUser);
      } else {
        updateUser({ ...user, mustChangePassword: false });
      }

      setSuccess(true);
      setTimeout(() => {
        const role = updatedUser?.role || user?.role;
        if (role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/driver');
        }
      }, 1500);
    } catch (err) {
      const code = err.errorCode || err.code;
      const msg = code ? t(`errors.${code}`) : (err.message || t('auth.change_password_failed'));
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-shape shape-1"></div>
        <div className="login-bg-shape shape-2"></div>
      </div>
      <div className="login-card" style={{ maxWidth: '460px' }}>
        <div className="login-header">
          <div className="login-brand">
            <BrandIcon variant="full" height={104} />
          </div>
          <p className="login-subtitle">
            {user?.mustChangePassword
              ? t('auth.must_change_password')
              : t('auth.update_password')}
          </p>
        </div>

        {success ? (
          <div className="alert alert-success card-glass">
            <CheckCircle size={18} />
            {t('auth.change_password_success')}
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">{t('auth.current_password')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="currentPassword"
                  className="form-input"
                  placeholder={t('common.current_password_placeholder')}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('auth.new_password')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="newPassword"
                  className="form-input"
                  placeholder={t('common.new_password_placeholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('auth.confirm_password')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  className="form-input"
                  placeholder={t('common.confirm_password_placeholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <label className="flex items-center gap-sm text-sm text-muted" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                />
                {t('auth.show_passwords')}
              </label>

              <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                {loading ? <span className="spinner"></span> : <Lock size={18} />}
                {loading ? t('common.loading') : t('auth.change_password_btn')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
