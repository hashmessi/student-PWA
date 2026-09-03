import { useState } from 'react'
import { saveStudentCompleteDataset } from '../lib/db'
import { useToast } from './ToastContext'

const POSE_INFO = {
  front: { title: 'Front Pose', icon: '👤', angle: '0° Gaze', desc: 'Straight-on gaze' },
  left: { title: 'Left Profile', icon: '👈', angle: 'Left Cheek', desc: 'Left profile exposed' },
  right: { title: 'Right Profile', icon: '👉', angle: 'Right Cheek', desc: 'Right profile exposed' },
  overall: { title: 'Overall Clarity', icon: '✨', angle: '720×720', desc: 'Neutral expression' },
}

export default function ReviewScreen({ student, captures, onRetakePose, onCancel, onSaved }) {
  const [isSaving, setIsSaving] = useState(false)
  const [lightboxPose, setLightboxPose] = useState(null)
  const { show } = useToast()

  const handleSaveAndConfirm = async () => {
    setIsSaving(true)
    try {
      const saved = await saveStudentCompleteDataset(student, captures)
      show(`Dataset for ${student.name} saved to offline database!`, 'success')
      onSaved(saved)
    } catch (err) {
      console.error('Error saving captured dataset:', err)
      show('Failed to save dataset to database', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const poses = ['front', 'left', 'right', 'overall']
  const capturedCount = poses.filter(p => captures[p]?.dataUrl || captures[p]?.blob).length

  return (
    <div className="page" style={{ paddingBottom: 'var(--space-8)' }}>
      {/* Lightbox Zoom Modal for 720x720 Inspection */}
      {lightboxPose && captures[lightboxPose] && (
        <div
          className="modal-backdrop"
          onClick={() => setLightboxPose(null)}
          role="dialog"
          aria-modal="true"
          style={{ padding: 'var(--space-4)', zIndex: 120 }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{POSE_INFO[lightboxPose].icon}</span>
                <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>{POSE_INFO[lightboxPose].title}</strong>
              </div>
              <button
                className="btn btn--icon btn--ghost"
                onClick={() => setLightboxPose(null)}
                aria-label="Close lightbox"
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
                src={captures[lightboxPose].dataUrl}
                alt={`${lightboxPose} full preview`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div className="row-between" style={{ fontSize: '12px', color: 'var(--color-mid-gray)' }}>
              <span>Standard: 720×720 JPEG @ 85%</span>
              <span className="font-mono">{POSE_INFO[lightboxPose].angle}</span>
            </div>

            <div className="row" style={{ gap: '8px', marginTop: '4px' }}>
              <button
                className="btn btn--secondary btn--sm btn--full"
                onClick={() => {
                  const idx = poses.indexOf(lightboxPose)
                  setLightboxPose(null)
                  onRetakePose(idx)
                }}
              >
                ↺ Retake Pose
              </button>
              <button
                className="btn btn--primary btn--sm btn--full"
                onClick={() => setLightboxPose(null)}
              >
                Looks Good
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
        <button
          id="review-back-btn"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
        >
          ← Discard
        </button>
        <span className="badge badge--success">
          {capturedCount} of 4 Poses Ready
        </span>
      </div>

      {/* Student Identity Card */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-4)',
          padding: '14px 18px',
        }}
      >
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '2px' }}>{student.name}</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-mid-gray)', fontFamily: 'var(--font-mono)' }}>
              {student.regNo} · {student.dept} - Sec {student.section}
            </div>
          </div>
          <span className="badge badge--muted font-mono">
            720×720 JPG
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--color-ink)' }}>Review Captured Poses</h3>
        <p style={{ fontSize: '12px', color: 'var(--color-mid-gray)' }}>
          Click any thumbnail to inspect 720×720 detail. Click "Retake" to correct any single angle.
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
          const info = POSE_INFO[pose]
          const score = capture?.qualityScore || {}

          return (
            <div
              key={pose}
              id={`review-thumbnail-${pose}`}
              className="card"
              style={{
                padding: '10px',
                borderColor: capture ? 'var(--color-hairline)' : 'var(--danger-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Image Thumbnail with zoom trigger */}
              <div
                onClick={() => capture && setLightboxPose(pose)}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--r-nested)',
                  overflow: 'hidden',
                  background: '#000',
                  border: '1px solid var(--color-hairline)',
                  cursor: capture ? 'pointer' : 'default',
                }}
                title="Click to zoom preview"
              >
                {capture && capture.dataUrl ? (
                  <>
                    <img
                      src={capture.dataUrl}
                      alt={`${pose} capture`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        padding: '2px 6px',
                        borderRadius: 'var(--r-sm)',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 500,
                      }}
                    >
                      🔍 720p
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-ember)',
                      fontSize: '12px',
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
                    background: 'rgba(10, 10, 10, 0.85)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {info.icon} {info.title.split(' ')[0]}
                </div>
              </div>

              {/* Quality score pills */}
              {score.sharpness !== undefined && (
                <div
                  className="row"
                  style={{
                    gap: '4px',
                    fontSize: '10px',
                    color: 'var(--color-mid-gray)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <span title="Sharpness score">✨ {score.sharpness}</span>
                  <span>•</span>
                  <span title="Yaw angle">📐 {score.yaw}°</span>
                </div>
              )}

              {/* Angle Label & Retake Action */}
              <div className="row-between" style={{ padding: '0 2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-mid-gray)', fontFamily: 'var(--font-mono)' }}>
                  {info.angle}
                </span>
                <button
                  id={`retake-btn-${pose}`}
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => onRetakePose(index)}
                  style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    minHeight: '26px',
                    color: 'var(--color-ink)',
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
          disabled={isSaving || capturedCount < 4}
        >
          {isSaving ? 'Saving Dataset to Database…' : '✓ Confirm & Save Student Dataset'}
        </button>
        <button
          id="review-cancel-btn"
          type="button"
          className="btn btn--ghost btn--full btn--sm"
          onClick={onCancel}
        >
          Cancel & Return to Roster
        </button>
      </div>
    </div>
  )
}
