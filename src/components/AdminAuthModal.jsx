import { useState, useRef, useEffect } from 'react'
import { verifyAdminPasscode } from '../lib/auth'

export default function AdminAuthModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setPin('')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!pin || pin.length < 4) {
      setError('Please enter the 4-digit admin passcode')
      return
    }

    setIsVerifying(true)
    setError('')
    try {
      const isValid = await verifyAdminPasscode(pin)
      if (isValid) {
        onSuccess()
        onClose()
      } else {
        setError('Incorrect admin passcode. Access denied.')
        setPin('')
        inputRef.current?.focus()
      }
    } catch (err) {
      console.error(err)
      setError('Authentication verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ padding: 'var(--space-4)', zIndex: 140 }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '380px',
          width: '100%',
          padding: '24px',
          textAlign: 'center',
          animation: 'page-enter 0.2s var(--ease-out) both',
        }}
      >
        {/* Security Lock Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
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

        <h2 style={{ fontSize: '1.25rem', marginBottom: '4px', color: 'var(--color-ink)' }}>
          Admin Vault Access
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-mid-gray)', marginBottom: '18px', lineHeight: '1.45' }}>
          Student database and export tools are protected. Enter the encrypted operator passcode to proceed.
        </p>

        <form onSubmit={handleSubmit} className="stack-3">
          <div>
            <input
              ref={inputRef}
              id="admin-passcode-input"
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="••••"
              value={pin}
              onChange={e => {
                setPin(e.target.value)
                setError('')
              }}
              className={`form-input font-mono${error ? ' form-input--error' : ''}`}
              style={{
                textAlign: 'center',
                letterSpacing: '0.4em',
                fontSize: '1.25rem',
                padding: '10px 16px',
              }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="form-error" role="alert" style={{ justifyContent: 'center' }}>
              <span>⛔</span> {error}
            </div>
          )}

          <div className="stack-2" style={{ marginTop: '8px' }}>
            <button
              id="admin-unlock-btn"
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled={isVerifying || pin.length < 4}
            >
              {isVerifying ? 'Verifying Hash…' : 'Unlock Admin Vault →'}
            </button>
            <button
              id="admin-cancel-btn"
              type="button"
              className="btn btn--ghost btn--full btn--sm"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
