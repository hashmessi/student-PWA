import { useState, useEffect, useCallback } from 'react'
import { getAllStudents, deleteStudent, seedDemoStudents, clearAllStudents } from '../lib/db'
import { useToast } from './ToastContext'
import StudentDetailModal from './StudentDetailModal'
import { generateExportZip, downloadBlob } from '../lib/exportEngine'

function EmptyState({ onNewStudent, onSeedDemo, isSeeding }) {
  return (
    <div
      className="card"
      style={{
        padding: '32px 24px',
        marginTop: 'var(--space-2)',
        textAlign: 'center'
      }}
    >
      {/* Top Station Badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
        <div className="badge badge--muted">
          <span>⚡</span>
          <span>DATASET INTAKE CONSOLE</span>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '6px', color: 'var(--color-ink)' }}>
        Biometric Collection Station
      </h2>
      <p style={{
        fontSize: '14px',
        maxWidth: '440px',
        margin: '0 auto var(--space-6)',
        color: 'var(--color-mid-gray)',
        lineHeight: '1.5'
      }}>
        Collect, auto-validate, and export 4-angle facial datasets for training the Smart Attendance face recognition model.
      </p>

      {/* 4-Step Biometric Pipeline Visualizer */}
      <div style={{
        background: 'var(--color-surface-alt)',
        borderRadius: 'var(--r-cards)',
        border: '1px solid var(--color-hairline)',
        padding: '16px 14px',
        marginBottom: 'var(--space-6)'
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-mid-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '12px'
        }}>
          Standard 4-Pose In-Browser Biometric Gate
        </div>

        <div className="pipeline-grid">
          {[
            { step: '1', pose: 'Front', angle: '0° Gaze', icon: '👤', desc: 'Dual eyes aligned, centered' },
            { step: '2', pose: 'Left', angle: '~45° Yaw', icon: '👈', desc: 'Profile turn & ear landmark' },
            { step: '3', pose: 'Right', angle: '~45° Yaw', icon: '👉', desc: 'Profile turn & ear landmark' },
            { step: '4', pose: 'Clarity', angle: '720×720', icon: '✨', desc: 'Laplacian variance check' },
          ].map((item) => (
            <div key={item.step} className="pipeline-item">
              <span className="pipeline-item-icon">{item.icon}</span>
              <div className="pipeline-item-name">{item.pose}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-mid-gray)', fontFamily: 'var(--font-mono)' }}>
                {item.angle}
              </div>
              <div className="pipeline-item-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Hero Actions */}
      <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          id="empty-new-student-btn"
          className="btn btn--primary btn--lg btn--full"
          onClick={onNewStudent}
        >
          + Register & Capture Student
        </button>

        <button
          id="empty-seed-demo-btn"
          type="button"
          className="btn btn--secondary btn--full"
          onClick={onSeedDemo}
          disabled={isSeeding}
        >
          {isSeeding ? 'Loading Demo Roster…' : '⚡ Load Sample Students (Demo Mode)'}
        </button>
      </div>

      {/* Institutional Guarantee Footer */}
      <div style={{
        marginTop: 'var(--space-6)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid var(--color-hairline)',
        display: 'flex',
        justifyContent: 'center',
        gap: '14px',
        fontSize: '12px',
        color: 'var(--color-mid-gray)',
        flexWrap: 'wrap'
      }}>
        <span>🔒 100% Offline IndexedDB</span>
        <span>•</span>
        <span>📁 Non-Mixed Folder Architecture</span>
        <span>•</span>
        <span>⚡ WASM Neural Gate</span>
      </div>
    </div>
  )
}

function getInitials(name) {
  if (!name) return '??'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function StatusBadge({ status }) {
  if (status === 'complete') return <span className="badge badge--success">✓ 4/4 Verified</span>
  if (status === 'in-progress') return <span className="badge badge--warning">◆ In Progress</span>
  return <span className="badge badge--muted">○ Pending</span>
}

export default function StudentList({
  onNewStudent,
  onRecaptureStudent,
  onLockAdmin,
}) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSeeding, setIsSeeding] = useState(false)
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'complete' | 'pending'
  const [searchQuery, setSearchQuery] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const { show } = useToast()

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getAllStudents()
      setStudents(all)
    } catch (err) {
      console.error('Failed to load students:', err)
      show('Failed to load students from database', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleSeedDemo = async () => {
    setIsSeeding(true)
    try {
      await seedDemoStudents()
      await loadStudents()
      show('Loaded sample student datasets for demo!', 'success')
    } catch (err) {
      console.error('Demo seed error:', err)
      show('Failed to load demo students', 'error')
    } finally {
      setIsSeeding(false)
    }
  }

  const handleClearAll = async () => {
    if (window.confirm('Clear all local student datasets? This cannot be undone.')) {
      try {
        await clearAllStudents()
        await loadStudents()
        show('Local dataset database cleared', 'info')
      } catch (err) {
        show('Failed to clear database', 'error')
      }
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      setExportProgress(0)
      const zipBlob = await generateExportZip((progress) => setExportProgress(progress))
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      downloadBlob(zipBlob, `Student_Face_Dataset_${timestamp}.zip`)
      
      show('Dataset archive exported successfully!', 'success')
    } catch (err) {
      console.error(err)
      show(err.message || 'Export failed', 'error')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  const completeCount = students.filter(s => s.status === 'complete').length
  const pendingCount = students.length - completeCount

  const filtered = students.filter(s => {
    if (filter === 'complete' && s.status !== 'complete') return false
    if (filter === 'pending' && s.status === 'complete') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = s.name.toLowerCase().includes(q)
      const matchReg = s.regNo.toLowerCase().includes(q)
      const matchEmail = (s.email || '').toLowerCase().includes(q)
      if (!matchName && !matchReg && !matchEmail) return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '55vh' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--color-mid-gray)'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid var(--color-hairline)',
            borderTopColor: 'var(--color-ink)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)' }}>
            Loading database records…
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Student Dataset Inspector Modal */}
      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
          onRecapture={(student, existingPhotos) => {
            setSelectedStudentForDetail(null)
            onRecaptureStudent(student, existingPhotos)
          }}
          onDeleted={(deletedRegNo) => {
            setStudents(prev => prev.filter(s => s.regNo !== deletedRegNo))
          }}
        />
      )}

      <div className="page">
        {/* Admin Console Protection Header */}
        <div
          className="row-between"
          style={{
            marginBottom: 'var(--space-4)',
            padding: '8px 14px',
            borderRadius: 'var(--r-buttons)',
            background: 'var(--color-paper)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px' }}>🔒</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
              Admin Console · Authenticated
            </span>
          </div>
          <button
            id="admin-lock-btn"
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onLockAdmin}
            style={{ fontSize: '12px', padding: '4px 10px', minHeight: '26px' }}
          >
            🔒 Lock Vault / Student Mode
          </button>
        </div>

        {/* Top Header Row */}
        <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '2px' }}>
              Student Datasets
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-mid-gray)' }}>
              {students.length === 0
                ? 'Admin dataset management console'
                : `${completeCount} verified datasets · ${pendingCount} pending capture`}
            </p>
          </div>

          {students.length > 0 && (
            <button
              id="new-student-btn"
              className="btn btn--primary btn--sm"
              onClick={onNewStudent}
            >
              + Add Student
            </button>
          )}
        </div>

        {students.length === 0 ? (
          <EmptyState
            onNewStudent={onNewStudent}
            onSeedDemo={handleSeedDemo}
            isSeeding={isSeeding}
          />
        ) : (
          <>
            {/* Quick Metrics Banner */}
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-card-label">Total Roster</span>
                <span className="stat-card-value">{students.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label" style={{ color: '#15803d' }}>Verified</span>
                <span className="stat-card-value" style={{ color: '#15803d' }}>{completeCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label" style={{ color: '#b45309' }}>Pending</span>
                <span className="stat-card-value" style={{ color: '#b45309' }}>{pendingCount}</span>
              </div>
            </div>

            {/* Search Input Bar with Icon and Clear Button */}
            <div className="search-wrapper">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                id="search-students-input"
                type="text"
                className="search-input"
                placeholder="Search by name, Reg.No, or email…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div
              className="row"
              style={{
                gap: '4px',
                marginBottom: 'var(--space-4)',
                background: 'var(--color-paper)',
                borderRadius: 'var(--r-buttons)',
                padding: '3px',
                border: '1px solid var(--color-hairline)',
              }}
            >
              {[
                ['all', `All (${students.length})`],
                ['complete', `Complete (${completeCount})`],
                ['pending', `Pending (${pendingCount})`],
              ].map(([val, label]) => (
                <button
                  key={val}
                  id={`filter-${val}-btn`}
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setFilter(val)}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '6px 10px',
                    minHeight: '28px',
                    borderRadius: 'var(--r-buttons)',
                    ...(filter === val ? {
                      background: 'var(--color-ink)',
                      color: '#ffffff',
                    } : {
                      color: 'var(--color-mid-gray)'
                    })
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Student Records List */}
            <div className="stack-2">
              {filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ color: 'var(--color-mid-gray)', fontSize: '13px' }}>
                    No students match the current filter or search query.
                  </p>
                </div>
              ) : (
                filtered.map(student => (
                  <div
                    key={student.regNo}
                    id={`student-item-${student.regNo}`}
                    className="student-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedStudentForDetail(student)}
                    onKeyDown={e => e.key === 'Enter' && setSelectedStudentForDetail(student)}
                    title={`Click to inspect 720×720 photos for ${student.name}`}
                  >
                    {/* Initials Avatar */}
                    <div className="student-avatar" aria-hidden="true">
                      {getInitials(student.name)}
                    </div>

                    {/* Student Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {student.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--color-mid-gray)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: '2px',
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: 'var(--color-ink-soft)', fontWeight: 500 }}>{student.regNo}</span>
                        <span>•</span>
                        <span>{student.dept} - Sec {student.section}</span>
                      </div>
                    </div>

                    {/* Status Badge & Arrow */}
                    <div className="row" style={{ gap: 'var(--space-2)', flexShrink: 0 }}>
                      <StatusBadge status={student.status} />
                      <span style={{ fontSize: '14px', color: 'var(--color-mid-gray)' }}>›</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Export Ready Card */}
            {completeCount > 0 && (
              <div
                className="card"
                style={{
                  marginTop: 'var(--space-6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '2px' }}>
                    📦 Export Ready ({completeCount} Student{completeCount > 1 ? 's' : ''})
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-mid-gray)', lineHeight: '1.4' }}>
                    {completeCount * 4} validated 720p images with <code className="font-mono">index.csv</code> and per-student <code className="font-mono">metadata.json</code>.
                  </div>
                </div>
                <button
                  id="export-dataset-btn"
                  className="btn btn--primary btn--md"
                  onClick={handleExport}
                  disabled={isExporting || completeCount === 0}
                  style={{ flexShrink: 0 }}
                >
                  {isExporting ? `Compiling (${exportProgress}%)…` : 'Export ZIP'}
                </button>
              </div>
            )}

            {/* Administrative Demo Controls Footer */}
            <div style={{
              marginTop: 'var(--space-8)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--color-mid-gray)'
            }}>
              <span>Local IndexedDB Vault</span>
              <div className="row" style={{ gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  className="btn btn--ghost btn--sm"
                >
                  ⚡ Add Demo Data
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn btn--ghost btn--sm"
                  style={{ color: 'var(--color-ember)' }}
                >
                  Reset Vault
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
