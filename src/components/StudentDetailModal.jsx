import { useState, useEffect } from 'react'
import { getStudentPhotos, deleteStudent } from '../lib/db'
import { useToast } from './ToastContext'
import { generateSingleStudentZip, downloadBlob } from '../lib/exportEngine'
import { isSupabaseConfigured, deleteStudentFromSupabase } from '../lib/supabase'

const POSE_INFO = {
  front: { title: 'Front Pose', icon: '👤', angle: '0° Neutral' },
  left: { title: 'Left Profile', icon: '👈', angle: 'Left Cheek' },
  right: { title: 'Right Profile', icon: '👉', angle: 'Right Cheek' },
  overall: { title: 'Overall Clarity', icon: '✨', angle: '720×720' },
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
  const [isExporting, setIsExporting] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        let result = await getStudentPhotos(student.regNo)

        // Fallback: If local IndexedDB doesn't have photos, use Supabase cloud photo URLs
        if ((!result || Object.keys(result).length === 0) && student.photoUrls) {
          result = {}
          for (const [pose, url] of Object.entries(student.photoUrls)) {
            if (url) {
              result[pose] = {
                dataUrl: url,
                pose,
                qualityScore: student.qualityScores?.[pose] || {},
              }
            }
          }
        }

        if (mounted) setPhotos(result || {})
      } catch (err) {
        console.error('Failed to load student photos:', err)
        show('Failed to retrieve photos from database', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [student.regNo, student.photoUrls, student.qualityScores, show])

  const handleDelete = async () => {
    try {
      await deleteStudent(student.regNo)

      if (isSupabaseConfigured()) {
        try {
          await deleteStudentFromSupabase(student.regNo)
        } catch (cloudErr) {
          console.warn('Cloud delete warning:', cloudErr)
        }
      }

      show(`Deleted ${student.name} (${student.regNo})`, 'success')
      onDeleted(student.regNo)
      onClose()
    } catch (err) {
      console.error('Delete error:', err)
      show('Failed to delete student record', 'error')
    }
  }

  const handleExportSingle = async () => {
    try {
      setIsExporting(true)
      const zipBlob = await generateSingleStudentZip(student, photos)
      const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '')
      downloadBlob(zipBlob, `${student.regNo}_${cleanName}_dataset.zip`)
      show(`Exported dataset for ${student.name}`, 'success')
    } catch (err) {
      console.error('Single export error:', err)
      show('Failed to export student dataset', 'error')
    } finally {
      setIsExporting(false)
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
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div className="row-between">
              <strong style={{ fontSize: '14px', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{POSE_INFO[lightboxPose].icon}</span>
                <span>{POSE_INFO[lightboxPose].title}</span>
              </strong>
              <button
                className="btn btn--icon btn--ghost"
                onClick={() => setLightboxPose(null)}
                aria-label="Close image preview"
              >
                ✕
              </button>
            </div>
            <div style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--r-nested)',
              overflow: 'hidden',
              background: '#000',
              border: '1px solid var(--color-hairline)',
            }}>
              <img
                src={photos[lightboxPose].dataUrl}
                alt={`${lightboxPose} full preview`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div className="row-between" style={{ fontSize: '12px', color: 'var(--color-mid-gray)' }}>
              <span>Standard: 720×720 JPEG @ 85%</span>
              <span className="font-mono">{POSE_INFO[lightboxPose].angle}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Detail Sheet */}
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '22px',
          animation: 'page-enter 0.2s var(--ease-out) both',
        }}
      >
        {/* Header Row */}
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge--accent font-mono">{student.regNo}</span>
            {student.status === 'complete' ? (
              <span className="badge badge--success">✓ 4/4 Verified</span>
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
          <h2 style={{ fontSize: '1.375rem', marginBottom: '4px', letterSpacing: '-0.02em' }}>{student.name}</h2>
          <div style={{ fontSize: '13px', color: 'var(--color-mid-gray)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>Dept of {student.dept}</span>
            <span>•</span>
            <span>Section {student.section}</span>
            <span>•</span>
            <span className="font-mono">{student.email}</span>
          </div>
          {student.capturedAt && (
            <div style={{ fontSize: '11px', color: 'var(--color-mid-gray)', marginTop: '4px' }}>
              Timestamp: {new Date(student.capturedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* 4 Photos Grid */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>
              Biometric Photo Matrix ({photoCount}/4)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-mid-gray)', fontFamily: 'var(--font-mono)' }}>
              Click to inspect 720×720
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-mid-gray)', fontSize: '13px' }}>
              Loading images from local vault…
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}
            >
              {poses.map((pose) => {
                const photo = photos[pose]
                const info = POSE_INFO[pose]

                return (
                  <div
                    key={pose}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: 'var(--r-nested)',
                      overflow: 'hidden',
                      background: 'var(--color-canvas)',
                      border: '1px solid var(--color-hairline)',
                      cursor: photo ? 'pointer' : 'default',
                      transition: 'border-color var(--duration-fast) var(--ease-out)'
                    }}
                    onClick={() => photo && setLightboxPose(pose)}
                    title={photo ? `Click to inspect 720×720 ${info.title}` : 'Not yet captured'}
                  >
                    {photo && photo.dataUrl ? (
                      <>
                        <img
                          src={photo.dataUrl}
                          alt={`${pose} pose`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          padding: '2px 6px',
                          borderRadius: 'var(--r-sm)',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          🔍 720p
                        </div>
                      </>
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-mid-gray)',
                        fontSize: '12px',
                        gap: '4px',
                      }}>
                        <span>{info.icon}</span>
                        <span>Pending</span>
                      </div>
                    )}

                    <div style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      padding: '2px 6px',
                      borderRadius: 'var(--r-sm)',
                      background: 'rgba(10, 10, 10, 0.85)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 500,
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
              borderRadius: 'var(--r-nested)',
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ember)', marginBottom: '4px' }}>
              Confirm Permanent Deletion?
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-soft)', marginBottom: '12px' }}>
              All 4 biometric photos and metadata for {student.name} will be purged from local storage.
            </div>
            <div className="row" style={{ gap: '8px' }}>
              <button
                className="btn btn--danger btn--sm btn--full"
                onClick={handleDelete}
              >
                Yes, Delete Dataset
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

            {photoCount > 0 && (
              <button
                id="detail-export-single-btn"
                className="btn btn--secondary btn--full btn--sm"
                onClick={handleExportSingle}
                disabled={isExporting}
              >
                {isExporting ? 'Generating ZIP…' : `📦 Export ${student.regNo} Folder (ZIP)`}
              </button>
            )}

            <div className="row" style={{ gap: '8px' }}>
              <button
                id="detail-delete-btn"
                className="btn btn--danger btn--sm btn--full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                🗑 Delete
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
