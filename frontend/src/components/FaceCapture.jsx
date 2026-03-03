import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "user" // Force front camera
};

export default function FaceCapture({ onCapture, onCancel }) {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [error, setError] = useState(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImgSrc(imageSrc);
  }, [webcamRef]);

  const retake = () => {
    setImgSrc(null);
    setError(null);
  };

  const confirm = () => {
    // Convert base64 to blob/file
    fetch(imgSrc)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        onCapture(file);
      })
      .catch(err => {
        setError("Failed to process image.");
        console.error(err);
      });
  };

  return (
    <div className="face-capture-container" style={{ textAlign: 'center' }}>
      {!imgSrc ? (
        <>
          <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: '#000', marginBottom: 'var(--space-md)' }}>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMediaError={() => setError("Camera access denied or not available.")}
              style={{ width: '100%', display: 'block' }}
            />
            {/* Outline overlay */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '60%',
              height: '70%',
              border: '2px dashed rgba(255,255,255,0.5)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }}></div>
          </div>
          
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-md justify-center">
            <button className="btn btn-primary" onClick={capture} disabled={!!error}>
              <Camera size={18} />
              Capture Selfie
            </button>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <img src={imgSrc} alt="captured" style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-md)' }} />
          <div className="flex gap-md justify-center">
            <button className="btn btn-primary" onClick={confirm}>
              <CheckCircle size={18} />
              Confirm Identity
            </button>
            <button className="btn btn-secondary" onClick={retake}>
              <RefreshCw size={18} />
              Retake
            </button>
          </div>
        </>
      )}
    </div>
  );
}
