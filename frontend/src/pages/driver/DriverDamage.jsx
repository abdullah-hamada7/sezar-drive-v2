import { useState, useRef, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { tripService } from '../../services/trip.service';
import { damageService } from '../../services/damage.service';
import { AlertTriangle, Camera, CheckCircle, X } from 'lucide-react';
import { useShift } from '../../contexts/ShiftContext';
import { ToastContext } from '../../contexts/toastContext';

export default function DriverDamage() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [step, setStep] = useState('form'); // form | success
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const { activeShift } = useShift();
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef(null);

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      loadContext();
    };

    window.addEventListener('ws:damage_update', handleUpdate);
    return () => {
      window.removeEventListener('ws:damage_update', handleUpdate);
    };
  }, []);

  async function loadContext() {
    try {
      const tripRes = await tripService.getTrips('limit=1&status=IN_PROGRESS');
      setActiveTrip(tripRes.data.trips?.[0]);
    } catch { /* ignore */ }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!activeShift) {
      addToast(t('damage.error_shift'), 'error');
      return;
    }

    const vehicleId = activeShift.vehicleId || activeShift.assignments?.[0]?.vehicleId;

    if (!vehicleId) {
      addToast(t('damage.error_vehicle'), 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await damageService.createDamageReport({
        description,
        shiftId: activeShift.id,
        vehicleId,
        tripId: activeTrip?.id
      });
      const reportId = res.data.id;

      // Upload photos
      for (const photo of photos) {
        const formData = new FormData();
        formData.append('photo', photo.file);
        await damageService.uploadDamagePhoto(reportId, formData);
      }

      setStep('success');
    } catch (err) {
      const code = err.errorCode || err.code;
      if (code) addToast(t(`errors.${code}`), 'error');
    } finally {
      setLoading(false);
    }
  }

  function addPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotos(prev => [...prev, { file, preview: URL.createObjectURL(file) }]);
    e.target.value = '';
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  if (step === 'success') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <CheckCircle size={56} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-md)' }} />
        <h2 style={{ marginBottom: 'var(--space-sm)' }}>{t('damage.success_title')}</h2>
        <p className="text-muted">{t('damage.success_desc')}</p>
        <button className="btn btn-secondary mt-lg" onClick={() => { setStep('form'); setDescription(''); setPhotos([]); }}>
          {t('damage.submit_another')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>{t('damage.report_title')}</h2>
      <input type="file" ref={fileRef} accept="image/*" capture="environment" onChange={addPhoto} style={{ display: 'none' }} />

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="form-group">
            <label className="form-label">{t('damage.describe_label')}</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              placeholder={t('damage.placeholder')}
              style={{ minHeight: '120px' }}
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>{t('damage.photos')}</label>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()}>
              <Camera size={14} /> {t('damage.add_photo')}
            </button>
          </div>

          {photos.length === 0 ? (
            <div
              className="empty-state"
              onClick={() => fileRef.current?.click()}
              style={{
                padding: 'var(--space-xl)',
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                padding: 'var(--space-md)',
                borderRadius: '50%',
                background: 'var(--color-bg-tertiary)',
                marginBottom: 'var(--space-md)'
              }}>
                <Camera size={32} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-sm font-medium" style={{ marginBottom: 'var(--space-xs)' }}>{t('damage.no_photos')}</p>
              <p className="text-xs text-muted">{t('damage.add_photo')}</p>
            </div>
          ) : (
            <div className="grid grid-3" style={{ gap: 'var(--space-sm)' }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p.preview} alt={`Damage ${i + 1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                  <button type="button" onClick={() => removePhoto(i)} style={{
                    position: 'absolute', top: '-6px', insetInlineEnd: '-6px',
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: 'var(--color-danger)', color: 'white',
                    border: 'none', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-danger" disabled={loading} style={{ width: '100%' }}>
          {loading ? <span className="spinner"></span> : <AlertTriangle size={18} />}
          {t('damage.submit')}
        </button>
      </form>
    </div>
  );
}
