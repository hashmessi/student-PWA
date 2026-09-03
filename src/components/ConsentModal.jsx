import { useEffect } from 'react'

export default function ConsentModal({ onAccept, onDecline }) {
  // Prevent background scroll while modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      id="consent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="modal-sheet">
        {/* Visual Badge Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-subtle), rgba(99,102,241,0.25))',
            border: '1px solid var(--border-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            boxShadow: '0 0 20px var(--accent-glow)'
          }}>
            🔒
          </div>
        </div>

        <h2
          id="consent-title"
          style={{ textAlign: 'center', marginBottom: '8px', fontSize: '1.25rem' }}
        >
          Data Privacy & Consent Notice
        </h2>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          Please review how student identity and face captures are handled in this application.
        </p>

        {/* Consent Points */}
        <div className="stack-2" style={{ marginBottom: '20px' }}>
          {[
            { icon: '📷', title: 'Local Device Storage', text: 'All captured images are saved strictly in offline browser storage (IndexedDB).' },
            { icon: '🎯', title: 'Attendance System Purpose', text: 'Datasets are used solely for training student face recognition models.' },
            { icon: '🚫', title: 'Zero Cloud Upload', text: 'No photos are transmitted to external servers or third-party cloud APIs.' },
            { icon: '🗑️', title: 'Operator Control & Deletion', text: 'Records and images can be deleted instantly at any time upon request.' },
          ].map((item, i) => (
            <div
              key={i}
              className="row"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: '1.2' }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {item.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginBottom: '20px',
          lineHeight: '1.45',
        }}>
          By proceeding, you confirm that student consent has been authorized under institutional compliance guidelines.
        </p>

        <div className="stack-2">
          <button
            id="consent-accept-btn"
            className="btn btn--primary btn--full btn--lg"
            onClick={onAccept}
          >
            I Understand & Agree — Continue
          </button>
          <button
            id="consent-decline-btn"
            className="btn btn--ghost btn--full btn--sm"
            onClick={onDecline}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
