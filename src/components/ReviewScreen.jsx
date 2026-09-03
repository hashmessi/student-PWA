import { useState } from 'react'
import { getDb, saveStudent } from '../lib/db'
import { useToast } from './ToastContext'

const POSE_LABELS = {
  front: { title: '1. Front Pose', icon: '👤', angle: '0° Neutral' },
  left: { title: '2. Left Pose', icon: '👈', angle: '~45° Left' },
  right: { title: '3. Right Pose', icon: '👉', angle: '~45° Right' },
  overall: { title: '4. Overall Clear', icon: '✨', angle: 'High Clarity' },
}

export default function ReviewScreen({ student, captures, onRetakePose, onCancel, onSaved }) {
  const [isSaving, setIsSaving] = useState(false)
  const { show } = useToast()

  const handleSaveAndConfirm = async () => {
    setIsSaving(true)
    try {
      const db = await getDb()
      const tx = db.transaction(['studentMeta', 'photoBlobs'], 'readwrite')
      const photoStore = tx.objectStore('photoBlobs')

      const poses = ['front', 'left', 'right', 'overall']
      const imagesMeta = {}

      for (const pose of poses) {
        const item = captures[pose]
        if (item && item.blob) {
          const blobId = `${student.regNo}_${pose}`
          await photoStore.put({
            id: blobId,
            regNo: student.regNo,
            pose,
            blob: item.blob,
            dataUrl: item.dataUrl,
            width: item.width || 720,
            height: item.height || 720,
            capturedAt: item.capturedAt || new Date().toISOString(),
          })
          imagesMeta[pose] = `${pose}.jpg`
        }
      }

      // Update student metadata to 'complete' status
      const updatedStudent = {
        ...student,
        status: 'complete',
        capturedAt: new Date().toISOString(),
        images: imagesMeta,
        qualityChecksPassed: true,
      }

      await tx.objectStore('studentMeta').put(updatedStudent)
      await tx.done

      show(`Dataset for ${student.name} saved successfully!`, 'success')
      onSaved(updatedStudent)
    } catch (err) {
      console.error('Error saving captured dataset:', err)
      show('Failed to save dataset to database', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const poses = ['front', 'left', 'right', 'overall']

  return (
    <div className="page" style={{ paddingBottom: 'var(--space-8)' }}>
      {/* Header */}
      <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
        <button
          id="review-back-btn"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
        >
          ✕ Cancel
        </button>
        <span className="badge badge--success">4 of 4 Captured</span>
      </div>

      {/* Student Identity Card */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-5)',
          padding: '14px 16px',
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-accent)',
        }}
      >
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '2px' }}>{student.name}</h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {student.regNo} · {student.dept} - Section {student.section}
            </div>
          </div>
          <span className="badge badge--accent font-mono" style={{ fontSize: '0.7rem' }}>
            720×720 JPG
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Review Captured Angles</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Verify clarity across all 4 poses. Tap "Retake" if any angle needs correction.
        </p>
      </div>

      {/* 2x2 Grid of Captured Thumbnails */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {poses.map((pose, index) => {
          const capture = captures[pose]
          const labelInfo = POSE_LABELS[pose]

          return (
            <div
              key={pose}
              id={`review-thumbnail-${pose}`}
              className="card"
              style={{
                padding: '8px',
                background: 'var(--bg-elevated)',
                borderColor: capture ? 'var(--border-subtle)' : 'rgba(239,68,68,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Image Thumbnail Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--r-md)',
                  overflow: 'hidden',
                  background: '#000',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {capture && capture.dataUrl ? (
                  <img
                    src={capture.dataUrl}
                    alt={`${pose} capture`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--danger)',
                      fontSize: '0.75rem',
                    }}
                  >
                    Missing
                  </div>
                )}

                {/* Pose Tag Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    padding: '2px 6px',
                    borderRadius: 'var(--r-sm)',
                    background: 'rgba(7, 7, 12, 0.85)',
                    backdropFilter: 'blur(6px)',
                    color: 'var(--text-primary)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                  }}
                >
                  {labelInfo.icon} {labelInfo.title.split(' ')[1]}
                </div>
              </div>

              {/* Angle Description & Retake Action */}
              <div className="row-between" style={{ padding: '0 2px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {labelInfo.angle}
                </span>
                <button
                  id={`retake-btn-${pose}`}
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => onRetakePose(index)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    color: 'var(--accent-hover)',
                  }}
                >
                  ↺ Retake
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmation CTA */}
      <div className="stack-2">
        <button
          id="confirm-save-dataset-btn"
          type="button"
          className="btn btn--primary btn--full btn--lg"
          onClick={handleSaveAndConfirm}
          disabled={isSaving}
        >
          {isSaving ? 'Saving to Database…' : '✓ Confirm & Save Student Dataset'}
        </button>
        <button
          id="review-cancel-btn"
          type="button"
          className="btn btn--ghost btn--full btn--sm"
          onClick={onCancel}
        >
          Discard & Return to Student List
        </button>
      </div>
    </div>
  )
}
