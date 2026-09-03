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
            width: '44px',
            height: '44px',
            borderRadius: 'var(--r-buttons)',
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-ink)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        </div>

        <h2
          id="consent-title"
          style={{ textAlign: 'center', marginBottom: '6px', fontSize: '1.25rem' }}
        >
          Data Privacy & Consent Notice
        </h2>

        <p style={{ textAlign: 'center', color: 'var(--color-mid-gray)', fontSize: '13px', marginBottom: '18px' }}>
          Please review how student identity and face captures are processed.
        </p>

        {/* Consent Points */}
        <div className="stack-2" style={{ marginBottom: '18px' }}>
          {[
            { title: 'Local Device Storage', text: 'All captured images are saved strictly in offline browser storage (IndexedDB).' },
            { title: 'Attendance System Purpose', text: 'Datasets are used solely for training student face recognition models.' },
            { title: 'Zero Cloud Upload', text: 'No photos are transmitted to external servers or third-party cloud APIs.' },
            { title: 'Operator Control & Deletion', text: 'Records and images can be deleted instantly at any time upon request.' },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--r-nested)',
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-hairline)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-mid-gray)', lineHeight: '1.4' }}>
                {item.text}
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontSize: '12px',
          color: 'var(--color-mid-gray)',
          textAlign: 'center',
          marginBottom: '18px',
          lineHeight: '1.4',
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
