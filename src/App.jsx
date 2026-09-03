import { useState, useEffect } from 'react'
import './index.css'
import { ToastProvider, useToast } from './components/ToastContext'
import RegistrationForm from './components/RegistrationForm'
import StudentList from './components/StudentList'
import CameraCapture from './components/CameraCapture'
import ReviewScreen from './components/ReviewScreen'
import AdminAuthModal from './components/AdminAuthModal'
import SubmissionSuccess from './components/SubmissionSuccess'
import { isAdminAuthenticated, logoutAdmin } from './lib/auth'

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
      className="card"
      style={{
        padding: '12px 16px',
        marginBottom: 'var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--r-buttons)',
          background: 'var(--color-canvas)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-ink)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>
          Install Progressive Web App
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-mid-gray)' }}>
          Launch full-screen offline from your desktop or home screen
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
      >
        ✕
      </button>
    </div>
  )
}

function AppContent() {
  const [isAdmin, setIsAdmin] = useState(() => isAdminAuthenticated())
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [page, setPage] = useState('register') // 'register' | 'capture' | 'review' | 'success' | 'list'
  const [activeStudent, setActiveStudent] = useState(null)
  const [activeCaptures, setActiveCaptures] = useState({})
  const [isRetakeMode, setIsRetakeMode] = useState(false)
  const [targetPoseIndex, setTargetPoseIndex] = useState(0)
  const [submittedStudent, setSubmittedStudent] = useState(null)
  const { show } = useToast()

  // Guard: if non-admin is on 'list' page, redirect to 'register'
  useEffect(() => {
    if (page === 'list' && !isAdmin) {
      setPage('register')
    }
  }, [page, isAdmin])

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
  const handleDatasetSaved = (savedStudent) => {
    const studentInfo = savedStudent || activeStudent
    setSubmittedStudent(studentInfo)
    setActiveStudent(null)
    setActiveCaptures({})
    setIsRetakeMode(false)
    setPage('success')
  }

  // Admin lock / logout
  const handleLockAdmin = () => {
    logoutAdmin()
    setIsAdmin(false)
    setActiveStudent(null)
    setActiveCaptures({})
    setPage('register')
    show('Admin session locked. Switched to Student Intake Mode.', 'info')
  }

  // Admin login success
  const handleAdminAuthSuccess = () => {
    setIsAdmin(true)
    setPage('list')
    show('Admin access granted! Dataset console unlocked.', 'success')
  }

  return (
    <div className="app-shell pt-safe pb-safe">
      {/* Admin Passcode Authentication Modal */}
      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAdminAuthSuccess}
      />

      <header className="app-header">
        <div
          className="app-header-icon"
          aria-hidden="true"
          onClick={() => {
            if (isAdmin) {
              setPage('list')
            } else {
              setPage('register')
            }
          }}
          style={{ cursor: 'pointer' }}
          title={isAdmin ? "Go to Admin Roster" : "Student Face Capture"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-ink)' }}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="app-header-title">Student Face Capture</div>
          <div className="app-header-subtitle">Smart Attendance · Dept of IT</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdmin ? (
            <>
              {page !== 'list' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setPage('list')}
                  style={{ fontSize: '11px', padding: '4px 10px', minHeight: '26px' }}
                >
                  📁 Admin Roster
                </button>
              )}
              <button
                id="header-lock-btn"
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handleLockAdmin}
                style={{ fontSize: '11px', padding: '4px 8px', minHeight: '26px', color: 'var(--color-mid-gray)' }}
                title="Lock admin session"
              >
                🔒 Lock
              </button>
            </>
          ) : (
            <button
              id="header-admin-vault-btn"
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setShowAuthModal(true)}
              style={{ fontSize: '11px', padding: '4px 10px', minHeight: '26px' }}
            >
              🔒 Admin Vault
            </button>
          )}
        </div>
      </header>

      {isAdmin && page === 'list' && <InstallPrompt />}

      <main>
        {/* Student Registration Form (Primary Student Intake Portal) */}
        {page === 'register' && (
          <RegistrationForm
            student={activeStudent}
            isAdmin={isAdmin}
            onBack={() => {
              setActiveStudent(null)
              if (isAdmin) {
                setPage('list')
              }
            }}
            onComplete={handleRegistrationComplete}
          />
        )}

        {/* 4-Step Biometric Camera Viewport */}
        {page === 'capture' && activeStudent && (
          <CameraCapture
            student={activeStudent}
            initialPoseIndex={targetPoseIndex}
            retakeMode={isRetakeMode}
            existingCaptures={activeCaptures}
            onCancel={() => {
              if (Object.keys(activeCaptures).length === 4 || isRetakeMode) {
                setPage('review')
              } else if (isAdmin) {
                setPage('list')
              } else {
                setPage('register')
              }
            }}
            onComplete={handleCaptureComplete}
            onRetakeComplete={handleSinglePoseRetakeComplete}
          />
        )}

        {/* Review & Angle Verification Screen */}
        {page === 'review' && activeStudent && (
          <ReviewScreen
            student={activeStudent}
            captures={activeCaptures}
            onRetakePose={handleRetakePose}
            onCancel={() => {
              setActiveStudent(null)
              setActiveCaptures({})
              setIsRetakeMode(false)
              if (isAdmin) {
                setPage('list')
              } else {
                setPage('register')
              }
            }}
            onSaved={handleDatasetSaved}
          />
        )}

        {/* Student Submission Confirmation Screen */}
        {page === 'success' && (
          <SubmissionSuccess
            student={submittedStudent}
            onRegisterNext={() => {
              setSubmittedStudent(null)
              setActiveStudent(null)
              setActiveCaptures({})
              setPage('register')
            }}
          />
        )}

        {/* Admin Roster & Master Export Dashboard (Protected) */}
        {page === 'list' && isAdmin && (
          <StudentList
            onNewStudent={() => {
              setActiveStudent(null)
              setActiveCaptures({})
              setPage('register')
            }}
            onRecaptureStudent={handleRecaptureStudent}
            onLockAdmin={handleLockAdmin}
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
