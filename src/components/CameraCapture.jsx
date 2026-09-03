import { useState, useEffect, useRef, useCallback } from 'react'
import PoseGuide from './PoseGuide'
import QualityOverlay from './QualityOverlay'
import { loadFaceModels, detectFacesInVideo, evaluateQualityGates } from '../lib/faceDetection'
import { cropAndCompressFaceImage } from '../lib/imageProcessing'
import { useToast } from './ToastContext'

const POSE_SEQUENCE = ['front', 'left', 'right', 'overall']

export default function CameraCapture({ student, initialPoseIndex = 0, onCancel, onComplete }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialPoseIndex)
  const [capturedImages, setCapturedImages] = useState({}) // { front, left, right, overall }
  const [modelsReady, setModelsReady] = useState(false)
  const [modelsError, setModelsError] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [qualityResult, setQualityResult] = useState(null)
  const [holdProgress, setHoldProgress] = useState(0) // 0 to 1
  const [isCapturing, setIsCapturing] = useState(false)
  const [facingMode, setFacingMode] = useState('user') // 'user' | 'environment'
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const holdStartTimeRef = useRef(null)
  const isCapturingRef = useRef(false)
  const qualityRef = useRef(null)
  const { show } = useToast()

  const currentPose = POSE_SEQUENCE[currentStepIndex]

  // 1. Load models on mount
  useEffect(() => {
    let mounted = true
    loadFaceModels()
      .then(() => {
        if (mounted) setModelsReady(true)
      })
      .catch(err => {
        if (mounted) setModelsError('Failed to load face detection neural network.')
      })
    return () => { mounted = false }
  }, [])

  // 2. Start Camera Stream
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }

    try {
      setCameraError(null)
      const constraints = {
        audio: false,
        video: {
          facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraError('Camera access denied or unavailable. Please grant permission.')
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [startCamera])

  // 3. Perform Capture Shot
  const executeCapture = useCallback(async () => {
    if (isCapturingRef.current || !videoRef.current) return
    isCapturingRef.current = true
    setIsCapturing(true)

    try {
      const box = qualityRef.current?.box || null
      const processed = await cropAndCompressFaceImage(videoRef.current, box, 720, 0.85)

      const captureRecord = {
        ...processed,
        pose: currentPose,
        capturedAt: new Date().toISOString(),
        qualityScore: qualityRef.current?.score || {},
      }

      const updatedCaptures = {
        ...capturedImages,
        [currentPose]: captureRecord,
      }

      setCapturedImages(updatedCaptures)

      // Audio / Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50)
      show(`Captured ${currentPose.toUpperCase()} pose!`, 'success', 2000)

      // Advance to next step or complete
      if (currentStepIndex < POSE_SEQUENCE.length - 1) {
        setTimeout(() => {
          setCurrentStepIndex(prev => prev + 1)
          setHoldProgress(0)
          holdStartTimeRef.current = null
          setIsCapturing(false)
          isCapturingRef.current = false
        }, 400)
      } else {
        setTimeout(() => {
          setIsCapturing(false)
          isCapturingRef.current = false
          onComplete(student, updatedCaptures)
        }, 500)
      }
    } catch (err) {
      console.error('Capture compression error:', err)
      show('Failed to capture frame', 'error')
      setIsCapturing(false)
      isCapturingRef.current = false
    }
  }, [currentPose, currentStepIndex, capturedImages, student, onComplete, show])

  // 4. Real-time Detection & Quality Evaluation Loop
  useEffect(() => {
    if (!modelsReady || cameraError) return

    let lastEvalTime = 0
    const evalInterval = 80 // evaluate every ~80ms (~12fps evaluation for low CPU)
    const REQUIRED_HOLD_MS = 900 // Hold still for 900ms for auto-capture

    const checkFrame = async (timestamp) => {
      if (videoRef.current && videoRef.current.readyState >= 2 && !isCapturingRef.current) {
        if (timestamp - lastEvalTime >= evalInterval) {
          lastEvalTime = timestamp
          const detections = await detectFacesInVideo(videoRef.current)
          const evaluation = evaluateQualityGates(detections, videoRef.current, currentPose)

          setQualityResult(evaluation)
          qualityRef.current = evaluation

          // Auto-capture stabilization timer logic
          if (evaluation.passed && autoCaptureEnabled) {
            if (!holdStartTimeRef.current) {
              holdStartTimeRef.current = timestamp
            }
            const elapsed = timestamp - holdStartTimeRef.current
            const progress = Math.min(1, elapsed / REQUIRED_HOLD_MS)
            setHoldProgress(progress)

            if (elapsed >= REQUIRED_HOLD_MS && !isCapturingRef.current) {
              executeCapture()
            }
          } else {
            holdStartTimeRef.current = null
            setHoldProgress(0)
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(checkFrame)
    }

    animFrameRef.current = requestAnimationFrame(checkFrame)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [modelsReady, cameraError, currentPose, autoCaptureEnabled, executeCapture])

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'))
  }

  return (
    <div className="page" style={{ paddingBottom: 'var(--space-6)' }}>
      {/* Top Student Header */}
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <button
          id="capture-cancel-btn"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
        >
          ✕ Cancel
        </button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {student.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {student.regNo} · {student.dept}-{student.section}
          </div>
        </div>
      </div>

      {/* 4-Step Pose Guidance */}
      <PoseGuide
        currentStep={currentStepIndex}
        capturedCount={Object.keys(capturedImages).length}
      />

      {/* Camera Viewfinder Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '3 / 4',
          maxHeight: '56vh',
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          background: '#000000',
          border: '1px solid var(--border-base)',
          boxShadow: 'var(--shadow-lg)',
          marginTop: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}
      >
        {/* Live Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />

        {/* Quality Overlays (Oval + Box + Feedback Badge + Shutter Flash) */}
        {modelsReady && !cameraError && (
          <QualityOverlay
            qualityResult={qualityResult}
            expectedPose={currentPose}
            holdProgress={holdProgress}
            isCapturing={isCapturing}
          />
        )}

        {/* Neural Model Loader Overlay */}
        {!modelsReady && !modelsError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(7, 7, 12, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--text-primary)'
          }}>
            <div style={{ fontSize: '28px', animation: 'spin 1.2s linear infinite' }}>⚙️</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Loading Offline Face Models…</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Initializing WASM neural detector</div>
          </div>
        )}

        {/* Camera Permission / Access Error */}
        {cameraError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(7, 7, 12, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            gap: '12px'
          }}>
            <div style={{ fontSize: '32px' }}>📷</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}>Camera Unavailable</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{cameraError}</div>
            <button className="btn btn--primary btn--sm" onClick={startCamera}>
              Retry Camera
            </button>
          </div>
        )}

        {/* Camera Flip Action Button */}
        <button
          id="camera-flip-btn"
          type="button"
          onClick={toggleCamera}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(22, 22, 30, 0.75)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            cursor: 'pointer',
            zIndex: 10
          }}
          aria-label="Switch camera"
          title="Switch Camera"
        >
          🔄
        </button>
      </div>

      {/* Bottom Controls Bar */}
      <div className="row-between" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
        {/* Auto Capture Toggle */}
        <button
          id="toggle-autocapture-btn"
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setAutoCaptureEnabled(prev => !prev)}
          style={{
            fontSize: '0.75rem',
            color: autoCaptureEnabled ? 'var(--accent-hover)' : 'var(--text-muted)'
          }}
        >
          {autoCaptureEnabled ? '⚡ Auto-Capture: ON' : '🖐 Auto-Capture: OFF'}
        </button>

        {/* Manual Shutter Button */}
        <button
          id="manual-capture-btn"
          type="button"
          className="btn btn--primary btn--lg"
          onClick={executeCapture}
          disabled={!qualityResult?.passed || isCapturing}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: qualityResult?.passed ? '0 0 20px var(--accent-glow)' : 'none',
          }}
        >
          <span>📸</span>
          <span>{isCapturing ? 'Capturing…' : `Capture ${currentPose.toUpperCase()}`}</span>
        </button>
      </div>
    </div>
  )
}
