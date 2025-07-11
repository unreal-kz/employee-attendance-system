import React, { useState, useRef } from 'react';
import QrReader from 'react-qr-reader';
import Webcam from 'react-webcam';

const BACKEND_URL = 'http://185.32.84.81:8080';
const FACE_API_URL = 'http://185.32.84.81:8081';

function App() {
  const [step, setStep] = useState(1); // 1: QR, 2: Face, 3: Preview
  const [qrData, setQrData] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [faceImg, setFaceImg] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const webcamRef = useRef(null);

  // Handle QR scan
  const handleScan = data => {
    if (data) {
      setQrData(data);
      try {
        // Try to extract employee_id from QR (base64-encoded JSON)
        const decoded = JSON.parse(atob(data.split('.')[0] || data));
        setEmployeeId(decoded.employee_id || '');
      } catch {
        setEmployeeId('');
      }
      setStep(2);
    }
  };
  const handleError = err => {
    alert('QR Scan Error: ' + err);
  };

  // Handle face capture
  const capture = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setFaceImg(imageSrc);
    setStep(3);
  };

  // Submit attendance
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      // 1. Validate QR
      const qrRes = await fetch(`${BACKEND_URL}/validate-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: qrData })
      });
      if (!qrRes.ok) throw new Error('QR validation failed');
      const qrJson = await qrRes.json();
      // 2. Verify face
      const formData = new FormData();
      formData.append('employee_id', employeeId);
      // Convert base64 to blob
      const blob = await (await fetch(faceImg)).blob();
      formData.append('image', blob, 'face.jpg');
      const faceRes = await fetch(`${FACE_API_URL}/verify-face`, {
        method: 'POST',
        body: formData
      });
      if (!faceRes.ok) throw new Error('Face verification failed');
      const faceJson = await faceRes.json();
      if (!faceJson.verified) throw new Error('Face not verified');
      // 3. Mark attendance
      const attRes = await fetch(`${BACKEND_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          verified: true,
          method: 'qr+face'
        })
      });
      if (!attRes.ok) throw new Error('Attendance failed');
      const attJson = await attRes.json();
      setResult({
        status: 'success',
        message: `Attendance ${attJson.status.replace('_', ' ')}!`,
        attendance_id: attJson.attendance_id
      });
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Reset
  const reset = () => {
    setStep(1);
    setQrData('');
    setEmployeeId('');
    setFaceImg(null);
    setResult(null);
    setError('');
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #eee', padding: 24 }}>
      <h2 style={{ textAlign: 'center' }}>Employee Attendance</h2>
      {step === 1 && (
        <div>
          <h4>Step 1: Scan QR Code</h4>
          <QrReader
            delay={300}
            onError={handleError}
            onScan={handleScan}
            style={{ width: '100%' }}
          />
          <p style={{ textAlign: 'center', color: '#888' }}>Point your badge or phone QR at the camera</p>
        </div>
      )}
      {step === 2 && (
        <div>
          <h4>Step 2: Capture Face</h4>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width="100%"
            videoConstraints={{ facingMode: 'user' }}
            style={{ borderRadius: 8, width: '100%' }}
          />
          <button onClick={capture} style={{ marginTop: 16, width: '100%' }}>Capture Face</button>
        </div>
      )}
      {step === 3 && (
        <div>
          <h4>Step 3: Preview & Submit</h4>
          <div style={{ textAlign: 'center' }}>
            <img src={faceImg} alt="Face Preview" style={{ width: 180, borderRadius: 8, marginBottom: 12 }} />
            <div style={{ marginBottom: 8 }}>
              <strong>Employee ID:</strong> {employeeId || 'N/A'}
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>QR Data:</strong> <span style={{ fontSize: 12 }}>{qrData.slice(0, 32)}...</span>
            </div>
            <button style={{ marginRight: 8 }} onClick={reset}>Start Over</button>
            <button onClick={handleSubmit} disabled={loading} style={{ background: '#1976d2', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: 4, minWidth: 100 }}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
            {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
            {result && <div style={{ color: 'green', marginTop: 12 }}>{result.message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 