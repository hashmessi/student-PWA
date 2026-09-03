import { useState, useEffect } from 'react'
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection, normalizeSupabaseUrl } from '../lib/supabase'
import { useToast } from './ToastContext'

export default function CloudConfigModal({ isOpen, onClose, onConfigSaved }) {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const { show } = useToast()

  useEffect(() => {
    if (isOpen) {
      const current = getSupabaseConfig()
      setUrl(current.url)
      setAnonKey(current.anonKey)
      setStatusMessage(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleTest = async () => {
    if (!url || !anonKey) {
      setStatusMessage({ type: 'error', text: 'Please provide both Supabase URL and Anon Key' })
      return
    }

    setTesting(true)
    setStatusMessage(null)

    const normalized = normalizeSupabaseUrl(url)
    setUrl(normalized)

    // Save formatted URL & Key
    saveSupabaseConfig(normalized, anonKey)

    try {
      await testSupabaseConnection()
      setStatusMessage({ type: 'success', text: '✅ Connected to Supabase students table successfully!' })
      show('Cloud connection verified!', 'success')
    } catch (err) {
      console.error('Supabase test error:', err)
      setStatusMessage({
        type: 'error',
        text: `Connection failed: ${err.message || 'Check URL/Key or run supabase_schema.sql'}`,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    const normalized = normalizeSupabaseUrl(url)
    setUrl(normalized)
    saveSupabaseConfig(normalized, anonKey)
    show('Cloud sync settings saved!', 'success')
    if (onConfigSaved) onConfigSaved()
    onClose()
  }

  const handleClear = () => {
    saveSupabaseConfig('', '')
    setUrl('')
    setAnonKey('')
    setStatusMessage({ type: 'info', text: 'Cloud credentials cleared. App using local IndexedDB only.' })
    show('Cloud credentials cleared', 'info')
    if (onConfigSaved) onConfigSaved()
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
          maxWidth: '480px',
          width: '100%',
          padding: '24px',
          animation: 'page-enter 0.2s var(--ease-out) both',
        }}
      >
        <div className="row-between" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>☁️</span>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-ink)' }}>
              Central Cloud Sync (Supabase)
            </h2>
          </div>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--color-mid-gray)', marginBottom: '18px', lineHeight: '1.45' }}>
          Connect Supabase so students can capture photos on their individual mobile phones and automatically sync them directly to your Admin Vault.
        </p>

        <div className="stack-3">
          <div>
            <label className="form-label" htmlFor="supabase-url-input">
              Supabase Project URL
            </label>
            <input
              id="supabase-url-input"
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="form-input font-mono"
              style={{ fontSize: '13px' }}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="supabase-anon-input">
              Supabase Anon Public Key
            </label>
            <input
              id="supabase-anon-input"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={e => setAnonKey(e.target.value)}
              className="form-input font-mono"
              style={{ fontSize: '13px' }}
            />
          </div>

          {statusMessage && (
            <div
              className={`badge ${statusMessage.type === 'success' ? 'badge--success' : statusMessage.type === 'error' ? 'badge--danger' : 'badge--muted'}`}
              style={{ padding: '8px 12px', borderRadius: 'var(--r-nested)', width: '100%', justifyContent: 'center' }}
            >
              {statusMessage.text}
            </div>
          )}

          <div style={{
            padding: '10px 12px',
            background: 'var(--color-surface-alt)',
            borderRadius: 'var(--r-nested)',
            border: '1px solid var(--color-hairline)',
            fontSize: '12px',
            color: 'var(--color-mid-gray)',
          }}>
            💡 <strong>Setup Tip:</strong> Run the 1-click SQL in <code>supabase_schema.sql</code> in your Supabase SQL Editor to create the <code>students</code> table and <code>student-faces</code> storage bucket.
          </div>

          <div className="row-between" style={{ gap: '8px', marginTop: '6px' }}>
            <button
              id="test-cloud-btn"
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleTest}
              disabled={testing || !url || !anonKey}
            >
              {testing ? 'Testing Connection…' : '⚡ Test Connection'}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              {(url || anonKey) && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
              <button
                id="save-cloud-btn"
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleSave}
              >
                Save & Sync Roster
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
