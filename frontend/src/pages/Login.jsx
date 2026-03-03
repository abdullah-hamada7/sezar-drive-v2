import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../contexts/theme';
import { ToastContext } from '../contexts/toastContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Car, Eye, EyeOff, LogIn, Sun, Moon } from 'lucide-react';
import { authService as api } from '../services/auth.service';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Login.css';

export default function LoginPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { addToast } = useContext(ToastContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('login'); // login | rescue-request | rescue-verify
  const [rescueCode, setRescueCode] = useState('');
  const [rescueLoading, setRescueLoading] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const getErrorMessage = (err) => {
    const code = err.errorCode || err.code;
    if (code) {
      const translationKey = `errors.${code}`;
      const translated = t(translationKey);
      // If i18next returns the key itself, it means the translation is missing
      if (translated !== translationKey) {
        return translated;
      }
    }
    return err.message || t('common.error');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await login(email, password);
      if (result?.requiresVerification) {
        navigate('/verify-device', {
          state: {
            userId: result.userId,
            deviceFingerprint: result.deviceFingerprint
          }
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRequestRescue = async (e) => {
    e.preventDefault();
    setError('');
    setRescueLoading(true);
    try {
      const res = await api.requestRescue(email);
      setRescueLoading(false);
      setView('rescue-verify');
      if (res?.message) addToast(res.message, 'success');
    } catch (err) {
      setError(getErrorMessage(err));
      setRescueLoading(false);
    }
  };

  const handleVerifyRescue = async (e) => {
    e.preventDefault();
    setError('');
    setRescueLoading(true);
    try {
      const res = await api.verifyRescueCode(email, rescueCode);
      navigate(`/reset-password?token=${res.data.resetToken}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setRescueLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-shape shape-1"></div>
        <div className="login-bg-shape shape-2"></div>
      </div>

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10, display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn-icon"
          onClick={toggleTheme}
          style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', color: 'var(--color-text)' }}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <LanguageSwitcher style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }} />
      </div>

      <div className="login-card glass-card">
        <div className="login-header">
          <div className="login-logo glow-effect">
            <Car size={32} />
          </div>
          <h1 className="login-title text-gradient">{t('common.brand')}</h1>
          <p className="login-subtitle">
            {t('nav.dashboard')}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {view === 'login' ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder={t('auth.enter_email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">{t('auth.password')}</label>
                <button
                  type="button"
                  className="forgot-password-trigger"
                  onClick={() => {
                    setView('rescue-request');
                    setError('');
                  }}
                >
                  {t('auth.forgot_password')}
                </button>
              </div>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="form-input"
                  placeholder={t('auth.enter_password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? <span className="spinner"></span> : <LogIn size={18} className="mirror-rtl" />}
              {loading ? t('auth.signing_in') : t('auth.sign_in')}
            </button>
          </form>
        ) : (
          <div className="forgot-password-view">
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              {view === 'rescue-request' ? t('auth.rescue_request_title') :
                t('auth.rescue_verify_title')}
            </h2>
            <p className="login-subtitle" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              {view === 'rescue-request' ? t('auth.rescue_request_desc') :
                t('auth.rescue_verify_desc')}
            </p>



            {view === 'rescue-request' && (
              <form onSubmit={handleRequestRescue} className="login-form">
                <div className="form-group">
                  <label className="form-label">{t('auth.email')}</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary login-btn" disabled={rescueLoading}>
                  {rescueLoading ? <span className="spinner"></span> : t('auth.request_rescue_btn')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setView('login')}>
                  {t('common.back')}
                </button>
              </form>
            )}

            {view === 'rescue-verify' && (
              <form onSubmit={handleVerifyRescue} className="login-form">
                <div className="form-group">
                  <label className="form-label">{t('auth.rescue_code')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="000000"
                    maxLength={6}
                    value={rescueCode}
                    onChange={(e) => setRescueCode(e.target.value)}
                    required
                    autoFocus
                    style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.5rem' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary login-btn" disabled={rescueLoading}>
                  {rescueLoading ? <span className="spinner"></span> : t('auth.verify_rescue_btn')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setView('rescue-request')}>
                  {t('auth.resend_request')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
