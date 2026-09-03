import { useState, useEffect } from 'react'
import './index.css'
import { ToastProvider, useToast } from './components/ToastContext'
import RegistrationForm from './components/RegistrationForm'
import StudentList from './components/StudentList'
import CameraCapture from './components/CameraCapture'
import ReviewScreen from './components/ReviewScreen'

// PWA Install Prompt Banner
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setVisible(true)
      }
    }

    const appInstalledHandler = () => {
      setVisible(false)
      setDeferredPrompt(null)
      show('App installed successfully! Accessible offline.', 'success')
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', appInstalledHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', appInstalledHandler)
    }
  }, [show])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      show('Installing Student Face Capture PWA…', 'success')
    }
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      id="install-prompt-banner"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.06))',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--r-md)',
        padding: '12px 16px',
        marginBottom: 'var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}
    >
      <span style={{ fontSize: '1.4rem' }}>📲</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Install Web App
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Add to home screen for fast offline dataset collection
        </div>
      </div>
      <button
        id="install-accept-btn"
        className="btn btn--primary btn--sm"
        onClick={handleInstall}
      >
        Install
      </button>
      <button
        id="install-dismiss-btn"
        className="btn btn--icon btn--ghost"
        onClick={() => setVisible(false)}
        aria-label="Dismiss install prompt"
        style={{ color: 'var(--text-muted)' }}
      >
        ✕
      </button>
    </div>
  )
}

function AppContent() {
  const [page, setPage] = useState('list') // 'list' | 'register' | 'capture' | 'review'
  const [activeStudent, setActiveStudent] = useState(null)
  const [activeCaptures, setActiveCaptures] = useState({})
  const [isRetakeMode, setIsRetakeMode] = useState(false)
  const [targetPoseIndex, setTargetPoseIndex] = useState(0)

  // 1. Initial registration completed -> Go to camera capture for all 4 poses
  const handleRegistrationComplete = (student) => {
    setActiveStudent(student)
    setActiveCaptures({})
    setIsRetakeMode(false)
    setTargetPoseIndex(0)
    setPage('capture')
  }

  // 2. All 4 poses captured -> Go to review screen
  const handleCaptureComplete = (student, captures) => {
    setActiveStudent(student)
    setActiveCaptures(captures)
    setIsRetakeMode(false)
    setPage('review')
  }

  // 3. Single-pose retake requested from ReviewScreen
  const handleRetakePose = (poseIndex) => {
    setTargetPoseIndex(poseIndex)
    setIsRetakeMode(true)
    setPage('capture')
  }

  // 4. Single-pose retake captured -> Update activeCaptures and return immediately to review
  const handleSinglePoseRetakeComplete = (poseName, captureData) => {
    setActiveCaptures(prev => ({
      ...prev,
      [poseName]: captureData,
    }))
    setIsRetakeMode(false)
    setPage('review')
  }

  // 5. Recapturing an existing student from StudentList detail modal
  const handleRecaptureStudent = (student, existingPhotos = {}) => {
    setActiveStudent(student)
    setActiveCaptures(existingPhotos)
    setIsRetakeMode(false)
    setTargetPoseIndex(0)
    setPage('capture')
  }

  // 6. Dataset confirmed & saved to IndexedDB
  const handleDatasetSaved = () => {
    setActiveStudent(null)
    setActiveCaptures({})
    setIsRetakeMode(false)
    setPage('list')
  }

  return (
    <div className="app-shell pt-safe pb-safe">
      <header className="app-header">
        <div
          className="app-header-icon"
          aria-hidden="true"
          onClick={() => {
            setActiveStudent(null)
            setActiveCaptures({})
            setPage('list')
          }}
          style={{ cursor: 'pointer' }}
          title="Return to Student List"
        >
          📸
        </div>
        <div style={{ flex: 1 }}>
          <div className="app-header-title">Student Face Capture</div>
          <div className="app-header-subtitle">Smart Attendance · IT Department</div>
        </div>
        <span className="badge badge--success" style={{ fontSize: '0.65rem' }}>Offline Ready</span>
      </header>

      {page === 'list' && <InstallPrompt />}

      <main>
        {page === 'list' && (
          <StudentList
            onNewStudent={() => {
              setActiveStudent(null)
              setActiveCaptures({})
              setPage('register')
            }}
            onRecaptureStudent={handleRecaptureStudent}
          />
        )}

        {page === 'register' && (
          <RegistrationForm
            student={activeStudent}
            onBack={() => {
              setActiveStudent(null)
              setPage('list')
            }}
            onComplete={handleRegistrationComplete}
          />
        )}

        {page === 'capture' && activeStudent && (
          <CameraCapture
            student={activeStudent}
            initialPoseIndex={targetPoseIndex}
            retakeMode={isRetakeMode}
            existingCaptures={activeCaptures}
            onCancel={() => {
              if (Object.keys(activeCaptures).length === 4 || isRetakeMode) {
                setPage('review')
              } else {
                setPage('list')
              }
            }}
            onComplete={handleCaptureComplete}
            onRetakeComplete={handleSinglePoseRetakeComplete}
          />
        )}

        {page === 'review' && activeStudent && (
          <ReviewScreen
            student={activeStudent}
            captures={activeCaptures}
            onRetakePose={handleRetakePose}
            onCancel={() => {
              setActiveStudent(null)
              setActiveCaptures({})
              setIsRetakeMode(false)
              setPage('list')
            }}
            onSaved={handleDatasetSaved}
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
