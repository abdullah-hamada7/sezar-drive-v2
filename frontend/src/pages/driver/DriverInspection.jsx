import { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { inspectionService as api } from '../../services/inspection.service';
import { offlineQueue } from '../../services/offline-queue.service';
import { Camera, CheckCircle, Upload, ChevronRight, AlertCircle } from 'lucide-react';
import { ToastContext } from '../../contexts/toastContext';
import { useShift } from '../../contexts/ShiftContext';

const DIRECTIONS = ['front', 'back', 'left', 'right'];
const CHECKLIST_KEYS = ['tires', 'lights', 'brakes', 'mirrors', 'fluids', 'seatbelts', 'horn', 'wipers'];
const CHECKLIST_PHOTO_CODES = {
  tires: 'tire',
  lights: 'light',
  brakes: 'brake',
  mirrors: 'mirror',
  fluids: 'fluid',
  seatbelts: 'seat',
  horn: 'horn',
  wipers: 'wiper'
};
const STEPS = ['checklist', 'photos', 'review'];
const generateIdempotencyKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function DriverInspection() {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const { activeShift: shift } = useShift();
  const [step, setStep] = useState('checklist'); // checklist | photos | review | done
  const [checks, setChecks] = useState(() =>
    CHECKLIST_KEYS.reduce((acc, key) => ({ ...acc, [key]: null }), {})
  );
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState({});
  const [issuePhotos, setIssuePhotos] = useState({});
  const [existingInspections, setExistingInspections] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [queuedOfflineSubmit, setQueuedOfflineSubmit] = useState(false);

  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const [photoTarget, setPhotoTarget] = useState(null);

  const loadExisting = useCallback(async () => {
    if (!shift?.id) return;
    setLoadingExisting(true);
    try {
      const res = await api.getInspections(`shiftId=${shift.id}`);
      setExistingInspections(res.data || []);
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setLoadingExisting(false);
    }
  }, [shift?.id]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  useEffect(() => {
    const handleInspectionUpdate = () => {
      loadExisting();
    };

    window.addEventListener('ws:inspection_created', handleInspectionUpdate);
    window.addEventListener('ws:inspection_photo_uploaded', handleInspectionUpdate);
    window.addEventListener('ws:inspection_completed', handleInspectionUpdate);

    return () => {
      window.removeEventListener('ws:inspection_created', handleInspectionUpdate);
      window.removeEventListener('ws:inspection_photo_uploaded', handleInspectionUpdate);
      window.removeEventListener('ws:inspection_completed', handleInspectionUpdate);
    };
  }, [loadExisting]);

  function setCheckStatus(key, status) {
    setChecks(prev => ({ ...prev, [key]: status }));
  }

  function getTimingForInspection(insp) {
    if (!shift?.startedAt || !insp?.createdAt) return null;
    const created = new Date(insp.createdAt);
    const started = new Date(shift.startedAt);
    const closed = shift.closedAt ? new Date(shift.closedAt) : null;
    if (!isNaN(started.getTime()) && created <= started) return 'before';
    if (closed && !isNaN(closed.getTime()) && created >= closed) return 'after';
    if (closed && created > started && created < closed) return 'during';
    return null;
  }

   const inspectionType = shift?.status === 'PendingVerification' ? 'pre' : 'post';
   const stepIndex = STEPS.indexOf(step);
   const stepLabels = {
     checklist: t('inspection.step_checklist'),
     photos: t('inspection.step_photos'),
     review: t('inspection.step_review')
   };
  function isCompletedInspection(insp) {
    const photoCount = Array.isArray(insp.photos) ? insp.photos.length : 0;
    return insp.status === 'completed' && photoCount >= 4;
  }

  const hasPreInspection = existingInspections.some(insp => {
    const type = String(insp.type || '').toLowerCase();
    if (!isCompletedInspection(insp)) return false;
    if (['pre', 'before', 'pre_shift'].includes(type)) return true;
    if (type === 'full') return getTimingForInspection(insp) === 'before';
    return false;
  });
  const hasPostInspection = existingInspections.some(insp => {
    const type = String(insp.type || '').toLowerCase();
    if (!shift?.startedAt || !isCompletedInspection(insp)) return false;
    if (['post', 'after', 'post_shift'].includes(type)) {
      const created = insp?.createdAt ? new Date(insp.createdAt) : null;
      const started = new Date(shift.startedAt);
      return created && created > started;
    }
    if (type === 'full') return getTimingForInspection(insp) === 'after' || getTimingForInspection(insp) === 'during';
    return false;
  });
  const isInspectionLocked = inspectionType === 'pre' ? hasPreInspection : hasPostInspection;

  function getVehicleId() {
    return shift?.vehicleId
      || shift?.vehicle?.id
      || shift?.assignments?.[0]?.vehicleId
      || shift?.assignments?.[0]?.vehicle?.id
      || null;
  }

  async function submitChecklist() {
    const missingStatus = CHECKLIST_KEYS.some((key) => !checks[key]);
    if (missingStatus) {
      addToast(t('inspection.select_status_error'), 'error');
      return;
    }

    const missingIssuePhotos = CHECKLIST_KEYS.filter((key) => checks[key] === 'bad' && !issuePhotos[key]);
    if (missingIssuePhotos.length > 0) {
      addToast(t('inspection.bad_photo_required'), 'error');
      return;
    }

    setLoading(true);
    try {
      setStep('photos');
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      setLoading(false);
    }
  }

  function triggerPhotoCapture(direction) {
    setPhotoTarget({ type: 'direction', key: direction });
    fileRef.current?.click();
  }

  function triggerIssuePhotoCapture(checkKey) {
    setPhotoTarget({ type: 'issue', key: checkKey });
    fileRef.current?.click();
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !photoTarget || isInspectionLocked) return;

    if (photoTarget.type === 'direction') {
      setPhotos(prev => ({
        ...prev,
        [photoTarget.key]: {
          file,
          preview: URL.createObjectURL(file),
        }
      }));
    } else {
      setIssuePhotos(prev => ({
        ...prev,
        [photoTarget.key]: {
          file,
          direction: CHECKLIST_PHOTO_CODES[photoTarget.key],
          preview: URL.createObjectURL(file),
        }
      }));
    }

    setPhotoTarget(null);
    e.target.value = '';
  }

  async function completeInspection() {
    if (Object.keys(photos).length < 4) {
      addToast(t('inspection.photos_missing_error'), 'error');
      return;
    }

    const vehicleId = getVehicleId();
    if (!vehicleId) {
      addToast(t('errors.NO_VEHICLE_ASSIGNED'), 'error');
      return;
    }

    setLoading(true);
    try {
      setQueuedOfflineSubmit(false);
      const directionalPhotos = Object.fromEntries(
        DIRECTIONS
          .filter((direction) => photos[direction]?.file)
          .map((direction) => [direction, photos[direction].file])
      );

      const issuePhotoPayload = Object.fromEntries(
        Object.entries(issuePhotos).map(([key, value]) => [key, {
          file: value?.file || null,
          direction: value?.direction || CHECKLIST_PHOTO_CODES[key],
        }])
      );
      const createIdempotencyKey = generateIdempotencyKey();
      const completeIdempotencyKey = generateIdempotencyKey();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await offlineQueue.enqueue({
          endpoint: '/inspections',
          method: 'POST',
          body: {
            __offlineType: 'inspection_bundle',
            payload: {
              shiftId: shift.id,
              vehicleId,
              type: inspectionType,
              notes,
              checks,
              directionalPhotos,
              issuePhotos: issuePhotoPayload,
              createIdempotencyKey,
              completeIdempotencyKey,
            },
          },
        });
        addToast(t('common.offline.saved_will_sync'), 'info');
        setQueuedOfflineSubmit(true);
      } else {
        const created = await api.createInspection({
          shiftId: shift.id,
          vehicleId,
          type: inspectionType,
          notes,
        }, {
          headers: { 'Idempotency-Key': createIdempotencyKey },
          skipOfflineQueue: true,
        });
        const createdInspectionId = created?.data?.id;

        if (!createdInspectionId) {
          throw new Error(t('common.error'));
        }

        const badItemPhotos = {};

        for (const [direction, file] of Object.entries(directionalPhotos)) {
          const formData = new FormData();
          formData.append('photo', file);
          formData.append('direction', direction);
          await api.uploadInspectionPhoto(createdInspectionId, direction, formData);
        }

        for (const [checkKey, issue] of Object.entries(issuePhotoPayload)) {
          if (!issue?.file || !issue?.direction) {
            badItemPhotos[checkKey] = null;
            continue;
          }

          const formData = new FormData();
          formData.append('photo', issue.file);
          formData.append('direction', issue.direction);
          await api.uploadInspectionPhoto(createdInspectionId, issue.direction, formData);
          badItemPhotos[checkKey] = issue.direction;
        }

        await api.completeInspection(createdInspectionId, {
          checklistData: {
            checks,
            notes,
            badItemPhotos,
          }
        }, {
          headers: { 'Idempotency-Key': completeIdempotencyKey },
          skipOfflineQueue: true,
        });
      }

      setStep('done');
      await loadExisting();
    } catch (err) {
      const code = err.errorCode || err.code;
      addToast(code ? t(`errors.${code}`) : (err.message || t('common.error')), 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!shift) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <AlertCircle size={56} style={{ color: 'var(--color-warning)', margin: '0 auto var(--space-md)' }} />
        <h2 style={{ marginBottom: 'var(--space-sm)' }}>{t('inspection.no_shift_title')}</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>{t('inspection.no_shift_desc')}</p>
        <a href="/driver/shift" className="btn btn-primary">{t('inspection.go_shifts')}</a>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <CheckCircle size={56} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-md)' }} />
        <h2 style={{ marginBottom: 'var(--space-sm)' }}>{t('inspection.done_title')}</h2>
        <p className="text-muted">{queuedOfflineSubmit ? t('common.offline.inspection_queued') : t('inspection.done_desc')}</p>
        {queuedOfflineSubmit && (
          <div className="alert alert-info" style={{ marginTop: 'var(--space-md)' }}>
            <AlertCircle size={16} /> {t('common.offline.sync_auto_when_online')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="inspection-page">
      <h2 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>{t('inspection.title')}</h2>
      <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('inspection.title')}</span>
            <span className={`badge badge-status ${inspectionType === 'pre' ? 'badge-info' : 'badge-warning'}`}>
              {inspectionType === 'pre' ? t('inspection.before_shift') : t('inspection.after_shift')}
            </span>
          </div>
          <div className="flex items-center gap-sm">
            <span className="badge badge-neutral">{stepLabels[step] || step}</span>
            {shift?.vehicle?.plateNumber && <span className="badge badge-info">{shift.vehicle.plateNumber}</span>}
          </div>
        </div>
      </div>
      <input type="file" ref={fileRef} accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex items-start justify-between" style={{ gap: 'var(--space-md)' }}>
          <div>
            <div style={{ fontWeight: 700 }}>
              {inspectionType === 'pre' ? t('inspection.before_shift') : t('inspection.after_shift')}
            </div>
            <div className="text-sm text-muted">
              {inspectionType === 'pre' ? t('inspection.pre_shift_desc') : t('inspection.post_shift_desc')}
            </div>
          </div>
          <div className="flex items-center gap-sm">
            <span className={`badge badge-status ${inspectionType === 'pre' ? 'badge-info' : 'badge-warning'}`}>
              {inspectionType === 'pre' ? t('inspection.before_shift') : t('inspection.after_shift')}
            </span>
            <span className="badge badge-neutral">{stepLabels[step] || step}</span>
          </div>
        </div>
        {loadingExisting && <div className="text-xs text-muted mt-sm">{t('common.loading')}</div>}
        {isInspectionLocked && (
          <div className="alert alert-info mt-md">
            <AlertCircle size={16} /> {inspectionType === 'pre' ? t('inspection.pre_already_done') : t('inspection.post_already_done')}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
        <div className="flex items-center justify-between mb-sm">
          <span className="text-xs uppercase text-muted" style={{ letterSpacing: '0.08em' }}>{t('inspection.progress')}</span>
          <span className="text-xs text-muted">{stepIndex + 1}/{STEPS.length}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: 'var(--space-sm)' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              flex: 1, height: '6px', borderRadius: '999px',
              background: stepIndex >= i ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
              transition: 'background var(--transition-base)'
            }} />
          ))}
        </div>
        <div className="grid grid-3 gap-sm">
          {STEPS.map((s, i) => (
            <div key={s} className="text-xs" style={{ color: stepIndex >= i ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: stepIndex === i ? 600 : 500 }}>
              {stepLabels[s] || s}
            </div>
          ))}
        </div>
      </div>

      {step === 'checklist' && (
        <div>
          <p className="text-muted text-sm mb-md">{t('inspection.checklist_desc')}</p>
          <div className="grid grid-2 gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
            {CHECKLIST_KEYS.map(key => (
              <div
                key={key}
                className="card"
                style={{
                  padding: 'var(--space-md)',
                  borderColor: checks[key] === 'bad'
                    ? 'var(--color-danger)'
                    : checks[key] === 'good'
                      ? 'var(--color-success)'
                      : 'var(--color-border)',
                  background: checks[key] === 'bad'
                    ? 'var(--color-danger-bg)'
                    : checks[key] === 'good'
                      ? 'var(--color-success-bg)'
                      : 'var(--color-bg-secondary)',
                  opacity: isInspectionLocked ? 0.6 : 1,
                  textAlign: 'left'
                }}
              >
                <div className="text-sm" style={{ marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
                  {t(`inspection.checklist.${key}`)}
                </div>

                <div className="flex items-center gap-sm" style={{ marginBottom: checks[key] === 'bad' ? 'var(--space-sm)' : 0 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${checks[key] === 'good' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => !isInspectionLocked && setCheckStatus(key, 'good')}
                    disabled={isInspectionLocked}
                  >
                    {t('inspection.good')}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${checks[key] === 'bad' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => !isInspectionLocked && setCheckStatus(key, 'bad')}
                    disabled={isInspectionLocked}
                  >
                    {t('inspection.bad')}
                  </button>
                </div>

                {checks[key] === 'bad' && (
                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => triggerIssuePhotoCapture(key)}
                      disabled={isInspectionLocked}
                    >
                      <Upload size={14} /> {issuePhotos[key] ? t('inspection.captured') : t('inspection.upload_proof_photo')}
                    </button>
                    {issuePhotos[key]?.preview && (
                      <img
                        src={issuePhotos[key].preview}
                        alt={t(`inspection.checklist.${key}`)}
                        style={{
                          width: '100%',
                          maxHeight: '120px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)',
                          marginTop: 'var(--space-sm)'
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">{t('inspection.notes_label')}</label>
            <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('inspection.notes_placeholder')} disabled={isInspectionLocked} />
          </div>

          <button className="btn btn-primary" onClick={submitChecklist} disabled={loading || isInspectionLocked} style={{ width: '100%' }}>
            {loading ? <span className="spinner"></span> : <ChevronRight size={18} className="mirror-rtl" />}
            {t('inspection.continue_photos')}
          </button>
        </div>
      )}

      {step === 'photos' && (
        <div>
          <p className="text-muted text-sm mb-md">{t('inspection.photos_desc')}</p>
          <div className="grid grid-2" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            {DIRECTIONS.map(dir => (
              <button
                key={dir}
                type="button"
                className="card"
                onClick={() => !isInspectionLocked && triggerPhotoCapture(dir)}
                disabled={isInspectionLocked}
                style={{ textAlign: 'center', padding: 'var(--space-md)', cursor: isInspectionLocked ? 'not-allowed' : 'pointer', borderColor: photos[dir]?.preview ? 'var(--color-success)' : 'var(--color-border)' }}
              >
                {photos[dir]?.preview ? (
                  <img src={photos[dir].preview} alt={t(`inspection.directions.${dir}`)} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-sm)' }} />
                ) : (
                  <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-tertiary)', marginBottom: 'var(--space-sm)' }}>
                    <Camera size={32} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                )}
                <div className="text-sm" style={{ fontWeight: 600 }}>{t(`inspection.directions.${dir}`)}</div>
                <div className="text-xs text-muted">{photos[dir]?.preview ? t('inspection.captured') : t('inspection.tap_capture')}</div>
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setStep('review')}
            disabled={Object.keys(photos).length < 4 || isInspectionLocked}
            style={{ width: '100%' }}
          >
            <ChevronRight size={18} className="mirror-rtl" /> {t('inspection.review_complete')}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>{t('inspection.summary_title')}</h3>
            {CHECKLIST_KEYS.map(key => (
              <div key={key} className="flex items-center justify-between" style={{ padding: '0.375rem 0' }}>
                <span className="text-sm">{t(`inspection.checklist.${key}`)}</span>
                <span className={`badge badge-status ${checks[key] === 'good' ? 'badge-success' : 'badge-danger'}`}>
                  {checks[key] === 'good' ? t('inspection.good') : t('inspection.bad')}
                </span>
              </div>
            ))}
            {notes && (
              <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <span className="text-muted text-sm">{t('inspection.notes_label')}:</span>
                <p className="text-sm mt-sm">{notes}</p>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>{t('inspection.photos')}</h3>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              {DIRECTIONS.map(dir => (
                <div key={dir} className="text-sm">
                  <span>{t(`inspection.directions.${dir}`)}:</span>{' '}
                  <span className={photos[dir]?.preview ? 'badge badge-status badge-success' : 'badge badge-status badge-warning'}>
                    {photos[dir]?.preview ? t('inspection.uploaded') : t('inspection.missing')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {CHECKLIST_KEYS.some(key => checks[key] === 'bad') && (
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
              <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>{t('inspection.bad_items_photo_proof')}</h3>
              {CHECKLIST_KEYS.filter(key => checks[key] === 'bad').map((key) => (
                <div key={key} className="flex items-center justify-between" style={{ padding: '0.375rem 0' }}>
                  <span className="text-sm">{t(`inspection.checklist.${key}`)}</span>
                  <span className={issuePhotos[key] ? 'badge badge-status badge-success' : 'badge badge-status badge-danger'}>
                    {issuePhotos[key] ? t('inspection.uploaded') : t('inspection.missing')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {CHECKLIST_KEYS.some(key => checks[key] === 'bad') && (
            <div className="alert alert-info mb-md">
              <AlertCircle size={16} />
              {t('inspection.flag_alert')}
            </div>
          )}

          <button className="btn btn-success" onClick={completeInspection} disabled={loading || isInspectionLocked} style={{ width: '100%' }}>
            {loading ? <span className="spinner"></span> : <CheckCircle size={18} />}
            {t('inspection.submit')}
          </button>
        </div>
      )}
      <style>{`
        [data-theme="dark"] .inspection-page .text-muted {
          color: var(--color-text-secondary);
        }
        .inspection-page button.card {
          color: var(--color-text);
        }
        .inspection-page button.card .text-sm,
        .inspection-page button.card .text-xs {
          color: inherit;
        }
        .inspection-page .card {
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
        }
        .inspection-page .card-title {
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
}
