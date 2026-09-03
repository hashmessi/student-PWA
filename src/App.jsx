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
  const [retakePoseIndex, setRetakePoseIndex] = useState(0)
  const { show } = useToast()

  // 1. When registration completes, transition straight to guided camera capture
  const handleRegistrationComplete = (student) => {
    setActiveStudent(student)
    setActiveCaptures({})
    setRetakePoseIndex(0)
    setPage('capture')
  }

  // 2. When all 4 poses in camera capture finish, transition to Review
  const handleCaptureComplete = (student, captures) => {
    setActiveStudent(student)
    setActiveCaptures(captures)
    setPage('review')
  }

  // 3. When operator selects "Retake" on a specific pose from Review
  const handleRetakePose = (poseIndex) => {
    setRetakePoseIndex(poseIndex)
    setPage('capture')
  }

  // 4. When dataset is confirmed and saved in Review
  const handleDatasetSaved = () => {
    setActiveStudent(null)
    setActiveCaptures({})
    setPage('list')
  }

  return (
    <div className="app-shell pt-safe pb-safe">
      <header className="app-header">
        <div
          className="app-header-icon"
          aria-hidden="true"
          onClick={() => setPage('list')}
          style={{ cursor: 'pointer' }}
          title="Return to Dashboard"
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
              setPage('register')
            }}
            onSelectStudent={(s) => {
              setActiveStudent(s)
              setPage('register')
            }}
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
            initialPoseIndex={retakePoseIndex}
            onCancel={() => {
              // Return to list or review depending on whether we already have captures
              if (Object.keys(activeCaptures).length === 4) {
                setPage('review')
              } else {
                setPage('list')
              }
            }}
            onComplete={handleCaptureComplete}
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
