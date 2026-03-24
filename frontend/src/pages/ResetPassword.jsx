import { useState, useEffect, useCallback, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ToastContext } from '../contexts/toastContext';
import { useTranslation } from 'react-i18next';
import { authService as api } from '../services/auth.service';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Lock, Key, CheckCircle, Eye, EyeOff } from 'lucide-react';
import BrandIcon from '../components/BrandIcon';
import './Login.css';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const { addToast } = useContext(ToastContext);

  const getErrorMessage = useCallback((err) => {
    const code = err.errorCode || err.code;
    if (code) return t(`errors.${code}`);
    return err.message || t('common.error');
  }, [t]);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setIsValid(false);
      return;
    }

    const verifyToken = async () => {
      try {
        await api.verifyResetToken(token);
        setIsValid(true);
      } catch (err) {
        addToast(getErrorMessage(err), 'error');
        setIsValid(false);
      } finally {
        setValidating(false);
      }
    };

    verifyToken();
  }, [token, getErrorMessage, addToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return addToast(t('auth.passwords_dont_match'), 'error');
    }

    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="login-page">
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
          <LanguageSwitcher style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }} />
        </div>
        <div className="login-bg">
          <div className="login-bg-shape shape-1"></div>
          <div className="login-bg-shape shape-2"></div>
        </div>
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '2rem auto' }}></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isValid && !success) {
    return (
      <div className="login-page">
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
          <LanguageSwitcher style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }} />
        </div>
        <div className="login-bg">
          <div className="login-bg-shape shape-1"></div>
          <div className="login-bg-shape shape-2"></div>
        </div>
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-header">
            <div className="login-logo" style={{ background: 'var(--error-bg)', color: 'var(--error-text)' }}>
              <BrandIcon size={28} />
            </div>
            <h1 className="login-title">{t('auth.invalid_token')}</h1>
            <p className="login-subtitle">{t('auth.forgot_password_desc')}</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ marginTop: '2rem' }}>
            {t('auth.back_to_login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
        <LanguageSwitcher style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }} />
      </div>
      <div className="login-bg">
        <div className="login-bg-shape shape-1"></div>
        <div className="login-bg-shape shape-2"></div>
      </div>
      <div className="login-card glass-card">
        <div className="login-header">
          <h1 className="login-title text-gradient">{t('common.brand')}</h1>
          <p className="login-subtitle">
            {success ? t('auth.reset_success') : t('auth.reset_password_title')}
          </p>
        </div>

        {success ? (
          <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
            <CheckCircle size={24} />
            <span>{t('auth.reset_success')}</span>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">{t('auth.new_password')}</label>
                <div className="password-field">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder={t('common.new_password_placeholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewPassword(prev => !prev)}
                    aria-label={showNewPassword ? t('auth.hide_password') : t('auth.show_password')}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('auth.confirm_password')}</label>
                <div className="password-field">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder={t('common.confirm_password_placeholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                {loading ? <span className="spinner"></span> : t('auth.reset_btn')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
