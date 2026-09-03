import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const show = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev.slice(-3), { id, message, type }])
    timersRef.current[id] = setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const icons = { success: '✓', error: '✕', warning: '⚠' }

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            role="status"
            onClick={() => dismiss(t.id)}
          >
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0,
              background: t.type === 'success' ? 'var(--success-subtle)' : t.type === 'error' ? 'var(--danger-subtle)' : 'var(--warning-subtle)',
              color: t.type === 'success' ? 'var(--success)' : t.type === 'error' ? 'var(--danger)' : 'var(--warning)',
              border: `1px solid ${t.type === 'success' ? 'rgba(34,211,160,0.3)' : t.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
            }}>
              {icons[t.type] || '•'}
            </span>
            <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              {t.message}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
