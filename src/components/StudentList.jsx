import { useState, useEffect, useCallback } from 'react'
import { getAllStudents, deleteStudent, seedDemoStudents, clearAllStudents } from '../lib/db'
import { useToast } from './ToastContext'
import StudentDetailModal from './StudentDetailModal'
import { generateExportZip, downloadBlob } from '../lib/exportEngine'

function EmptyState({ onNewStudent, onSeedDemo, isSeeding }) {
  return (
    <div
      className="card card--elevated"
      style={{
        padding: 'var(--space-8) var(--space-6)',
        marginTop: 'var(--space-2)',
        borderColor: 'var(--border-accent)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        textAlign: 'center'
      }}
    >
      {/* Top Station Badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--r-full)',
          background: 'rgba(99, 102, 241, 0.14)',
          border: '1px solid var(--border-accent)',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--accent-hover)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase'
        }}>
          <span>⚡</span> Dataset Intake Console
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)', letterSpacing: '-0.02em' }}>
        Biometric Collection Station
      </h2>
      <p style={{
        fontSize: '0.875rem',
        maxWidth: '440px',
        margin: '0 auto var(--space-6)',
        color: 'var(--text-secondary)',
        lineHeight: '1.55'
      }}>
        Collect, auto-validate, and export 4-angle facial datasets for training and embedding into the Smart Attendance Neural Model.
      </p>

      {/* 4-Step Biometric Pipeline Visualizer */}
      <div style={{
        background: 'var(--bg-void)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-subtle)',
        padding: '16px 12px',
        marginBottom: 'var(--space-6)'
      }}>
        <div style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
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
              <div style={{ fontSize: '0.65rem', color: 'var(--accent-hover)', fontFamily: 'var(--font-mono)' }}>
                {item.angle}
              </div>
              <div className="pipeline-item-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Hero Actions */}
      <div style={{ maxWidth: '380px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          id="empty-new-student-btn"
          className="btn btn--primary btn--lg btn--full"
          onClick={onNewStudent}
          style={{
            fontSize: '1rem',
            padding: '14px 20px',
            boxShadow: '0 4px 20px var(--accent-glow)'
          }}
        >
          + Register & Capture Student
        </button>

        <button
          id="empty-seed-demo-btn"
          type="button"
          className="btn btn--secondary btn--md btn--full"
          onClick={onSeedDemo}
          disabled={isSeeding}
          style={{
            borderColor: 'var(--border-accent)',
            fontSize: '0.875rem',
            background: 'rgba(99, 102, 241, 0.08)'
          }}
        >
          {isSeeding ? 'Loading Demo Roster…' : '⚡ Load Sample Students (Demo Mode)'}
        </button>
      </div>

      {/* Institutional Guarantee Footer */}
      <div style={{
        marginTop: 'var(--space-6)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        fontSize: '0.725rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap'
      }}>
        <span>🔒 100% Offline IndexedDB</span>
        <span>•</span>
        <span>📁 Non-Mixed Folder Architecture</span>
        <span>•</span>
        <span>⚡ WASM Face Detection</span>
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
  if (status === 'complete') return <span className="badge badge--success">✓ 4/4 Poses</span>
  if (status === 'in-progress') return <span className="badge badge--warning">◆ In Progress</span>
  return <span className="badge badge--muted">○ Pending</span>
}

export default function StudentList({
  onNewStudent,
  onRecaptureStudent,
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
      show('Loaded 3 sample student datasets for demo!', 'success')
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
          gap: '12px',
          color: 'var(--text-muted)'
        }}>
          <div style={{ fontSize: '2rem', animation: 'spin 1.2s linear infinite' }}>⏳</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Accessing Local Offline Vault…
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
        {/* Top Header Row — only show top "+ New Student" button if students already exist */}
        <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '2px', letterSpacing: '-0.02em' }}>
              Student Datasets
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {students.length === 0
                ? 'Offline biometric collection workstation'
                : `${completeCount} validated datasets · ${pendingCount} pending capture`}
            </p>
          </div>

          {students.length > 0 && (
            <button
              id="new-student-btn"
              className="btn btn--primary btn--sm"
              onClick={onNewStudent}
              style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
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
              <div className="stat-card" style={{ borderColor: 'rgba(34, 211, 160, 0.3)' }}>
                <span className="stat-card-label" style={{ color: 'var(--success)' }}>Complete</span>
                <span className="stat-card-value" style={{ color: 'var(--success)' }}>{completeCount}</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <span className="stat-card-label" style={{ color: 'var(--warning)' }}>Pending</span>
                <span className="stat-card-value" style={{ color: 'var(--warning)' }}>{pendingCount}</span>
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
                background: 'var(--bg-surface)',
                borderRadius: 'var(--r-md)',
                padding: '4px',
                border: '1px solid var(--border-subtle)',
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
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '6px 8px',
                    ...(filter === val ? {
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border-accent)',
                      boxShadow: 'var(--shadow-sm)'
                    } : {
                      color: 'var(--text-muted)'
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
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {student.name}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: '2px',
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: 'var(--accent-hover)' }}>{student.regNo}</span>
                        <span>•</span>
                        <span>{student.dept} - Sec {student.section}</span>
                      </div>
                    </div>

                    {/* Status Badge & Inspection Indicator */}
                    <div className="row" style={{ gap: 'var(--space-2)', flexShrink: 0 }}>
                      <StatusBadge status={student.status} />
                      <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>›</span>
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
                  borderColor: 'var(--border-accent)',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(34,211,160,0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.35)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    📦 Export Ready ({completeCount} Student{completeCount > 1 ? 's' : ''})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {completeCount * 4} validated 720p images with <code className="font-mono">index.csv</code> and per-student <code className="font-mono">metadata.json</code>.
                  </div>
                </div>
                <button
                  id="export-dataset-btn"
                  className="btn btn--primary btn--md"
                  onClick={handleExport}
                  disabled={isExporting || completeCount === 0}
                  style={{
                    flexShrink: 0,
                    boxShadow: '0 2px 12px var(--accent-glow)'
                  }}
                >
                  {isExporting ? `Compiling (${exportProgress}%)…` : 'Export ZIP'}
                </button>
              </div>
            )}

            {/* Administrative Demo Controls Footer */}
            <div style={{
              marginTop: 'var(--space-8)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <span>Local Storage: Active</span>
              <div className="row" style={{ gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  className="btn btn--ghost btn--sm"
                  style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                >
                  ⚡ Add Demo Students
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn btn--ghost btn--sm"
                  style={{ fontSize: '0.75rem', color: 'var(--danger)' }}
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
