import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { shiftService } from '../../services/shift.service';
import { vehicleService } from '../../services/vehicle.service';
import { tripService } from '../../services/trip.service';
import { inspectionService } from '../../services/inspection.service';
import { useShift } from '../../contexts/ShiftContext';
import FaceCapture from '../../components/FaceCapture';
import QRScanner from '../../components/QRScanner';
import { ClipboardCheck, Play, Square, Loader, ShieldCheck, Camera, QrCode, CheckCircle2 } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import ConfirmModal from '../../components/common/ConfirmModal';

export default function DriverShift() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const { activeShift: shift, refreshShift, loading: shiftLoading } = useShift();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(null); // 'face' | 'qr'
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const res = await authService.getMe();
      setUser(res.data.user);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function startShift() {
    if (!user?.avatarUrl && !user?.profilePhotoUrl) {
      addToast(t('driver_home.identity_required'), 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await shiftService.createShift();
      await refreshShift();
      // Force face verification for every shift start
      setActiveStep('face');
    } catch (err) {
      const code = err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFaceCapture(file) {
    if (!file) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('selfie', file);

      const result = await shiftService.verifyShift(shift.id, formData);

      if (result.data.status === 'VERIFIED') {
        addToast(t('common.success'), 'success');
        setActiveStep(null);
        await refreshShift();
      } else if (result.data.status === 'MANUAL_REVIEW') {
        addToast(t('shift.manual_review_alert'), 'info');
        setActiveStep(null);
        await refreshShift();
      } else {
        addToast(t('shift.failed_alert'), 'error');
      }
    } catch (err) {
      const code = err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleQRScan(qrCode) {
    setActionLoading(true);
    try {
      await vehicleService.assignSelfVehicle(qrCode);
      addToast(t('common.success'), 'success');
      setActiveStep(null);
      await refreshShift();
    } catch (err) {
      const code = err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function activateShift() {
    setActionLoading(true);
    try {
      const inspectionsRes = await inspectionService.getInspections(`shiftId=${shift.id}`);
      const inspections = inspectionsRes.data || [];
      const hasCompletedInspection = inspections.some((insp) => {
        const photoCount = Array.isArray(insp.photos) ? insp.photos.length : 0;
        return insp.status === 'completed' && photoCount >= 4;
      });
      if (!hasCompletedInspection) {
        addToast(t('shift.inspection_required') || t('errors.INSPECTION_REQUIRED'), 'warning');
        navigate('/driver/inspection');
        return;
      }
      await shiftService.activateShift(shift.id);
      addToast(t('common.success'), 'success');
      await refreshShift();
    } catch (err) {
      const code = err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
      if (code === 'INSPECTION_REQUIRED' || code === 'INSPECTION_PHOTOS_REQUIRED') {
        navigate('/driver/inspection');
      }
    } finally { setActionLoading(false); }
  }

  async function onConfirmClose() {
    setShowConfirm(false);
    setActionLoading(true);
    try {
      const inspectionsRes = await inspectionService.getInspections(`shiftId=${shift.id}`);
      const inspections = inspectionsRes.data || [];
      const startedAt = shift?.startedAt ? new Date(shift.startedAt) : null;
      const hasEndInspection = inspections.some((insp) => {
        const createdAt = insp?.createdAt ? new Date(insp.createdAt) : null;
        const isAfterStart = startedAt && createdAt && createdAt > startedAt;
        const photoCount = Array.isArray(insp.photos) ? insp.photos.length : 0;
        return insp.status === 'completed' && isAfterStart && photoCount >= 4;
      });
      if (startedAt && !hasEndInspection) {
        addToast(t('errors.INSPECTION_REQUIRED') || t('shift.inspection_required') || 'End-of-shift inspection required', 'warning');
        navigate('/driver/inspection');
        return;
      }
      const tripsRes = await tripService.getTrips('limit=50');
      const trips = tripsRes.data?.trips || [];
      const hasActiveTrip = trips.some(t => t.status === 'ASSIGNED' || t.status === 'ACCEPTED' || t.status === 'IN_PROGRESS');
      if (hasActiveTrip) {
        addToast(t('errors.SHIFT_HAS_ACTIVE_TRIP') || 'You cannot end your shift while you have an assigned or active trip.', 'warning');
        return;
      }
      await shiftService.closeShift(shift.id);
      addToast(t('common.success'), 'success');
      await refreshShift();
    } catch (err) {
      const code = err?.code;
      addToast(code ? t(`errors.${code}`) : (err?.message || t('common.error')), 'error');
      if (code === 'INSPECTION_REQUIRED' || code === 'INSPECTION_PHOTOS_REQUIRED') {
        navigate('/driver/inspection');
      }
    } finally { setActionLoading(false); }
  }

  if (loading || shiftLoading) return <div className="loading-page"><div className="spinner"></div></div>;

  if (activeStep === 'face') {
    return (
      <div className="page-container">
        <h2 className="page-title">{t('shift.biometric_title')}</h2>
        <div className="card">
          <FaceCapture onCapture={handleFaceCapture} onCancel={() => setActiveStep(null)} />
        </div>
      </div>
    );
  }

  if (activeStep === 'qr') {
    return (
      <div className="page-container">
        <h2 className="page-title">{t('shift.scan_vehicle')}</h2>
        <div className="card">
          <QRScanner onScan={handleQRScan} onCancel={() => setActiveStep(null)} />
        </div>
      </div>
    );
  }

  const isVerified = shift?.verificationStatus === 'VERIFIED';
  const verificationLabel = shift?.verificationStatus
    ? t(`common.shift_verification_status.${shift.verificationStatus.toLowerCase()}`, shift.verificationStatus)
    : t('common.status.pending');
  const hasVehicle = !!shift?.vehicleId || !!shift?.vehicle;

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>{t('shift.management')}</h2>

      {!shift ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <ClipboardCheck size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto var(--space-md)' }} />
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>{t('shift.no_active')}</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-lg)' }}>
            {t('shift.start_desc')}
          </p>
          <button className="btn btn-primary" onClick={startShift} disabled={actionLoading}>
            {actionLoading ? <Loader size={18} className="spinning" /> : <ShieldCheck size={18} />}
            {t('shift.start_btn')}
          </button>
        </div>
      ) : shift.status === 'PendingVerification' ? (
        <div className="security-gate-container">
          <div className="card glass-card" style={{ marginBottom: 'var(--space-lg)', border: '1px solid var(--color-warning)' }}>
            <div className="flex items-center gap-md mb-lg">
              <div className="stat-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{t('shift.gate_title')}</h3>
                <p className="text-sm text-muted">{t('shift.gate_desc')}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Step 1: Face */}
              <div
                className={`gate-step card ${isVerified ? 'gate-step-done' : ''}`}
                onClick={() => !isVerified && setActiveStep('face')}
                style={{
                  cursor: isVerified ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem', background: isVerified ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)'
                }}
              >
                <div style={{ color: isVerified ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {isVerified ? <CheckCircle2 size={24} /> : <Camera size={24} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t('shift.face_verification')}</div>
                  <div className="text-xs text-muted">{isVerified ? t('shift.identity_confirmed') : verificationLabel}</div>
                </div>
                {!isVerified && <Play size={16} className="text-muted mirror-rtl" />}
              </div>

              {/* Step 2: QR */}
              <div
                className={`gate-step card ${hasVehicle ? 'gate-step-done' : ''}`}
                onClick={() => !hasVehicle && setActiveStep('qr')}
                style={{
                  cursor: hasVehicle ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem', background: hasVehicle ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)'
                }}
              >
                <div style={{ color: hasVehicle ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {hasVehicle ? <CheckCircle2 size={24} /> : <QrCode size={24} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t('shift.vehicle_checkin')}</div>
                  <div className="text-xs text-muted">
                    {hasVehicle ? `${t('shift.assigned')}: ${shift.vehicle?.plateNumber || ''}` : t('shift.scan_vehicle_desc')}
                  </div>
                </div>
                {!hasVehicle && <Play size={16} className="text-muted mirror-rtl" />}
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <button
                className="btn btn-primary"
                onClick={activateShift}
                disabled={!isVerified || !hasVehicle || actionLoading}
                style={{ width: '100%', padding: '1rem' }}
              >
                {actionLoading ? <Loader size={20} className="spinning" /> : <Play size={20} className="mirror-rtl" />}
                <span style={{ marginLeft: '0.5rem' }}>{t('shift.activate_and_drive_btn')}</span>
              </button>
            </div>
          </div>

          <button className="btn btn-ghost" onClick={() => setShowConfirm(true)} style={{ width: '100%' }}>
            {t('shift.cancel_request_btn')}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="stat-icon" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              padding: '1.5rem', borderRadius: '0.5rem',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>
                {t('shift.active')}
              </div>
              <div className="text-sm text-muted">{t('trip.status')}: {t('common.trip_status.in_progress')}</div>
            </div>
            <span className="badge badge-status badge-success" style={{ marginLeft: 'auto' }}>
              {t('common.trip_status.in_progress')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: 'var(--space-lg)' }}>
            <div className="flex justify-between">
              <span className="text-muted text-sm">{t('shift.vehicle')}</span>
              <span className="text-sm">{shift.vehicle?.plateNumber || shift.assignments?.[0]?.vehicle?.plateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-sm">{t('shift.started_at')}</span>
              <span className="text-sm">{shift.startedAt ? new Date(shift.startedAt).toLocaleTimeString() : '—'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-danger" onClick={() => setShowConfirm(true)} disabled={actionLoading} style={{ flex: 1 }}>
              {actionLoading ? <Loader size={18} /> : <Square size={18} />}
              {t('shift.end_btn')}
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={onConfirmClose}
        title={shift?.status === 'Active' ? t('shift.end_btn') : t('shift.cancel_request_btn')}
        message={shift?.status === 'Active' ? t('shift.close_confirm') : t('shift.cancel_request_confirm')}
      />
    </div>
  );
}
