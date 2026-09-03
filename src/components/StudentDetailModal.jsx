import { useState, useEffect } from 'react'
import { getStudentPhotos, deleteStudent } from '../lib/db'
import { useToast } from './ToastContext'

const POSE_INFO = {
  front: { title: 'Front Pose', icon: '👤', angle: '0° Neutral' },
  left: { title: 'Left Pose', icon: '👈', angle: '~45° Left' },
  right: { title: 'Right Pose', icon: '👉', angle: '~45° Right' },
  overall: { title: 'Overall Clear', icon: '✨', angle: 'Neutral Gaze' },
}

export default function StudentDetailModal({
  student,
  onClose,
  onRecapture,
  onRetakeSinglePose,
  onDeleted,
}) {
  const [photos, setPhotos] = useState({})
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lightboxPose, setLightboxPose] = useState(null)
  const { show } = useToast()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const result = await getStudentPhotos(student.regNo)
        if (mounted) setPhotos(result)
      } catch (err) {
        console.error('Failed to load student photos:', err)
        show('Failed to retrieve photos from database', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [student.regNo, show])

  const handleDelete = async () => {
    try {
      await deleteStudent(student.regNo)
      show(`Deleted ${student.name} (${student.regNo})`, 'success')
      onDeleted(student.regNo)
      onClose()
    } catch (err) {
      console.error('Delete error:', err)
      show('Failed to delete student record', 'error')
    }
  }

  const poses = ['front', 'left', 'right', 'overall']
  const photoCount = Object.keys(photos).length

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ padding: 'var(--space-3)', zIndex: 110, alignItems: 'center' }}
    >
      {/* Lightbox Zoom for 720x720 inspection */}
      {lightboxPose && photos[lightboxPose] && (
        <div
          className="modal-backdrop"
          onClick={() => setLightboxPose(null)}
          role="dialog"
          aria-modal="true"
          style={{ padding: 'var(--space-4)', zIndex: 130 }}
        >
          <div
            className="card card--elevated"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '16px',
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-accent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div className="row-between">
              <strong style={{ fontSize: '0.9375rem' }}>
                {POSE_INFO[lightboxPose].icon} {POSE_INFO[lightboxPose].title}
              </strong>
              <button
                className="btn btn--icon btn--ghost"
                onClick={() => setLightboxPose(null)}
              >
                ✕
              </button>
            </div>
            <div style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              background: '#000',
            }}>
              <img
                src={photos[lightboxPose].dataUrl}
                alt={`${lightboxPose} full preview`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div className="row-between" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>720×720 JPEG @ 85%</span>
              <span className="font-mono">{POSE_INFO[lightboxPose].angle}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Detail Sheet */}
      <div
        className="card card--elevated"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '20px',
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-accent)',
          borderRadius: 'var(--r-xl)',
          animation: 'page-enter 0.25s var(--ease-out) both',
        }}
      >
        {/* Header Row */}
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge--accent font-mono">{student.regNo}</span>
            {student.status === 'complete' ? (
              <span className="badge badge--success">✓ Complete Dataset</span>
            ) : (
              <span className="badge badge--warning">◆ Incomplete</span>
            )}
          </div>
          <button
            id="detail-close-btn"
            className="btn btn--icon btn--ghost"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        {/* Student Credential Info */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.375rem', marginBottom: '4px' }}>{student.name}</h2>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>🏛 Dept of {student.dept}</span>
            <span>•</span>
            <span>Section {student.section}</span>
            <span>•</span>
            <span>✉ {student.email}</span>
          </div>
          {student.capturedAt && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Captured: {new Date(student.capturedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* 4 Photos Grid */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Stored Photos ({photoCount}/4)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              720×720 JPG
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Loading photo blobs from IndexedDB…
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}
            >
              {poses.map((pose, idx) => {
                const photo = photos[pose]
                const info = POSE_INFO[pose]

                return (
                  <div
                    key={pose}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: 'var(--r-md)',
                      overflow: 'hidden',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      cursor: photo ? 'pointer' : 'default',
                    }}
                    onClick={() => photo && setLightboxPose(pose)}
                  >
                    {photo && photo.dataUrl ? (
                      <img
                        src={photo.dataUrl}
                        alt={`${pose} pose`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        gap: '4px',
                      }}>
                        <span>{info.icon}</span>
                        <span>Missing</span>
                      </div>
                    )}

                    <div style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      padding: '2px 6px',
                      borderRadius: 'var(--r-sm)',
                      background: 'rgba(7, 7, 12, 0.85)',
                      backdropFilter: 'blur(4px)',
                      color: 'var(--text-primary)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}>
                      {info.title.split(' ')[0]}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delete Confirmation Box if triggered */}
        {showDeleteConfirm ? (
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--r-md)',
              background: 'var(--danger-subtle)',
              border: '1px solid rgba(239,68,68,0.3)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fca5a5', marginBottom: '8px' }}>
              Confirm Permanent Deletion?
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              All 4 face photos will be purged from local storage.
            </div>
            <div className="row" style={{ gap: '8px' }}>
              <button
                className="btn btn--danger btn--sm btn--full"
                onClick={handleDelete}
              >
                Yes, Delete
              </button>
              <button
                className="btn btn--secondary btn--sm btn--full"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Action Buttons */
          <div className="stack-2">
            <button
              id="detail-recapture-btn"
              className="btn btn--primary btn--full"
              onClick={() => {
                onClose()
                onRecapture(student, photos)
              }}
            >
              🔄 Recapture Dataset (All 4 Poses)
            </button>
            <div className="row" style={{ gap: '8px' }}>
              <button
                id="detail-delete-btn"
                className="btn btn--danger btn--sm btn--full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                🗑 Delete Record
              </button>
              <button
                className="btn btn--secondary btn--sm btn--full"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
