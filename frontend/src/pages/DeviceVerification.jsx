import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Camera, ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService as api } from '../services/auth.service';
import { http } from '../services/http.service';
import './Login.css'; // Reuse login styles for consistency

export default function DeviceVerificationPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  const { userId, deviceFingerprint } = location.state || {};

  // Debug logging to catch why validation might fail
  useEffect(() => {
    console.log('Verification State:', { userId, deviceFingerprint });
    if (!userId || !deviceFingerprint) {
      console.warn('Missing userId or deviceFingerprint in location state');
    }
  }, [userId, deviceFingerprint]);

  // Attach stream to video element whenever stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      // Explicitly call play to handle some browser playback policies
      video.play().catch(e => console.error("Video play failed:", e));
    }
  }, [stream]);

  if (!userId || !deviceFingerprint) {
    return <Navigate to="/login" replace />;
  }

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(s);
      setError('');
    } catch (err) {
      console.error('Camera Access Error:', err);
      setError(t('inspection.camera_error'));
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !stream) return;

    setLoading(true);
    setError('');

    try {
      const video = videoRef.current;

      // Safety check for video readiness
      if (video.readyState < 2 || video.videoWidth === 0) {
        throw new Error('Video is not ready. Please wait a moment.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) {
        throw new Error('Failed to capture image from camera.');
      }

      const formData = new FormData();
      // Append text fields FIRST for robust multer parsing
      formData.append('userId', userId);
      formData.append('deviceFingerprint', deviceFingerprint);
      formData.append('photo', blob, 'selfie.jpg');

      const res = await api.verifyDevice(formData);
      const { user: userData, accessToken, refreshToken } = res.data;

      http.setTokens(accessToken, refreshToken);
      updateUser(userData);

      setSuccess(true);
      stopCamera();

      setTimeout(() => {
        if (userData.mustChangePassword) {
          navigate('/change-password');
        } else {
          navigate(userData.role === 'admin' ? '/admin' : '/driver');
        }
      }, 2000);
    } catch (err) {
      // DEV BYPASS for testing
      if (import.meta.env.VITE_DEV_BYPASS === 'true') {
        const res = await api.getMe(); // Get current user to proceed
        updateUser(res.data);
        setSuccess(true);
        setTimeout(() => navigate(res.data.role === 'admin' ? '/admin' : '/driver'), 1000);
        return;
      }
      const code = err.errorCode || err.code;
      setError(code ? t(`errors.${code}`) : (err.message || t('common.error')));
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

      <div className="login-card glass-card">
        <div className="login-header">
          <div className="login-logo text-gradient shadow-glow">
            <ShieldAlert size={32} />
          </div>
          <h1 className="login-title text-gradient">{t('auth.device_security_title')}</h1>
          <p className="login-subtitle">
            {t('auth.device_security_desc')}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success ? (
          <div className="verification-success" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="glow-effect" style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', marginBottom: '1rem' }}>
              <CheckCircle2 size={48} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              {t('auth.verification_success_title')}
            </h2>
            <p style={{ color: 'var(--color-text-muted)' }}>{t('auth.redirecting')}</p>
          </div>
        ) : (
          <div className="verification-camera-container" style={{ position: 'relative', borderRadius: '1rem', overflow: 'hidden', background: '#000', marginBottom: '1.5rem', aspectRatio: '3/4' }}>
            {!stream ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '1rem' }}>
                <Camera size={48} opacity={0.5} />
                <button className="btn btn-primary" onClick={startCamera}>
                  {t('auth.start_camera')}
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', bottom: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary"
                    onClick={captureAndVerify}
                    disabled={loading}
                    style={{ borderRadius: '2rem', padding: '0.75rem 2rem' }}
                  >
                    {loading ? <RefreshCw size={20} className="animate-spin" /> : <Camera size={20} />}
                    <span style={{ marginLeft: '0.5rem' }}>{t('auth.verify_identity_btn')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!success && (
          <button
            className="btn-ghost"
            onClick={() => { stopCamera(); navigate('/login'); }}
            style={{ width: '100%' }}
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
