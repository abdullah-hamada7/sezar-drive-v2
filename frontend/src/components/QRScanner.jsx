import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle, AlertCircle, X, Loader, QrCode } from 'lucide-react';

export default function QRScanner({ onScan, onCancel }) {
  const { t } = useTranslation();
  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scannedValue, setScannedValue] = useState(null);
  const scannerRef = useRef(null);
  const scannedRef = useRef(false); // prevent duplicate scans
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (scanMode !== 'camera') return;

    let html5QrCode = null;

    async function startScanner() {
      setError(null);
      setLoading(true);
      scannedRef.current = false;

      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Prevent duplicate callbacks
            if (scannedRef.current) return;
            scannedRef.current = true;

            setScannedValue(decodedText);
            // Stop scanner then notify parent
            html5QrCode.stop().catch(() => { });
            onScanRef.current(decodedText);
          },
          () => {
            // Ignore scan failures (no QR in frame) — this is normal
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        if (typeof err === 'string' && err.includes('NotAllowedError')) {
          setError(t('shift.camera_denied'));
        } else if (typeof err === 'string' && err.includes('NotFoundError')) {
          setError(t('shift.no_camera'));
        } else {
          setError(t('shift.camera_error'));
        }
      } finally {
        setLoading(false);
      }
    }

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => { });
        scannerRef.current = null;
      }
    };
  }, [scanMode, t]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScan(manualCode.trim());
  };

  const switchMode = (mode) => {
    if (mode === scanMode) return;
    // Stop camera if switching away
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => { });
      scannerRef.current = null;
    }
    setError(null);
    setScannedValue(null);
    scannedRef.current = false;
    setScanMode(mode);
  };

  return (
    <div className="qr-scanner-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Mode Toggle */}
      <div className="segmented-control" style={{
        display: 'flex',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
        border: '1px solid var(--color-border)'
      }}>
        <button
          className={`flex-1 btn-sm ${scanMode === 'camera' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => switchMode('camera')}
          style={{ borderRadius: 'calc(var(--radius-md) - 2px)', padding: '0.6rem' }}
        >
          <Camera size={16} />
          <span style={{ marginLeft: '0.5rem' }}>{t('shift.scan_camera')}</span>
        </button>
        <button
          className={`flex-1 btn-sm ${scanMode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => switchMode('manual')}
          style={{ borderRadius: 'calc(var(--radius-md) - 2px)', padding: '0.6rem' }}
        >
          <QrCode size={16} />
          <span style={{ marginLeft: '0.5rem' }}>{t('shift.type_manually')}</span>
        </button>
      </div>

      <div className="qr-scanner-content">
        {scanMode === 'camera' ? (
          <div style={{ position: 'relative' }}>
            {loading && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '3rem', color: 'var(--color-text-muted)'
              }}>
                <Loader size={24} className="spinning" />
                <span style={{ marginLeft: '0.5rem' }}>{t('shift.starting_camera')}</span>
              </div>
            )}
            <div
              id="qr-reader"
              style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            />
            {scannedValue && (
              <div style={{
                marginTop: '1rem', padding: '0.75rem 1rem',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontWeight: 600 }}>{t('shift.scanned_value', { value: scannedValue })}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="manual-entry-view card" style={{ padding: 'var(--space-xl)', background: 'var(--color-bg-secondary)' }}>
            <form onSubmit={handleManualSubmit}>
              <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="form-label">{t('shift.enter_vehicle_code')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('shift.manual_qr_placeholder')}
                  value={manualCode}
                  autoFocus
                  onChange={(e) => setManualCode(e.target.value)}
                  style={{ fontSize: '1.2rem', padding: '1rem', textAlign: 'center', letterSpacing: '2px' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!manualCode.trim() || loading}
                style={{ width: '100%', padding: '1rem' }}
              >
                <CheckCircle size={20} />
                <span style={{ marginLeft: '0.5rem' }}>{t('shift.confirm_assignment')}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Hide default html5-qrcode styles */}
      <style>{`
        #qr-reader {
          border: none !important;
          box-shadow: none !important;
        }
        #qr-reader__dashboard_section_csr button {
          background: var(--color-primary) !important;
          color: white !important;
          border: none !important;
          border-radius: var(--radius-md) !important;
          padding: 0.6rem 1.2rem !important;
          cursor: pointer !important;
          font-size: 0.875rem !important;
        }
        #qr-reader__dashboard_section_csr select {
          background: var(--color-bg-secondary) !important;
          color: var(--color-text) !important;
          border: 1px solid var(--color-border) !important;
          border-radius: var(--radius-md) !important;
          padding: 0.4rem 0.6rem !important;
        }
        #qr-reader__dashboard_section_csr {
          padding: 0.75rem !important;
        }
        #qr-reader__status_span {
          display: none !important;
        }
        #qr-reader__header_message {
          display: none !important;
        }
        #qr-reader img[alt="Info icon"] {
          display: none !important;
        }
        #qr-reader__dashboard_section_fsr {
          display: none !important;
        }
      `}</style>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <button className="btn btn-ghost" onClick={onCancel} style={{ width: '100%' }}>
        <X size={18} /> {t('common.cancel')}
      </button>
    </div>
  );
}
