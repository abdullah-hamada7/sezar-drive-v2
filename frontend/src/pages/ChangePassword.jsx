import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { authService as api } from '../services/auth.service';
import { http } from '../services/http.service';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import './Login.css';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwords_dont_match'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('drivers.modal.password_invalid'));
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({ currentPassword, newPassword });
      const { user: updatedUser, accessToken, refreshToken } = res.data;

      if (accessToken) {
        http.setTokens(accessToken, refreshToken);
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
      setError(msg);
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
          <div className="login-logo text-gradient shadow-glow">
            <Lock size={28} />
          </div>
          <h1 className="login-title text-gradient">{t('auth.change_password')}</h1>
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
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">{t('auth.current_password')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="currentPassword"
                  className="form-input"
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
