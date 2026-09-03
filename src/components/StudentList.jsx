import { useState, useEffect, useCallback } from 'react'
import { getAllStudents, deleteStudent } from '../lib/db'
import { useToast } from './ToastContext'
import StudentDetailModal from './StudentDetailModal'

function EmptyState({ onNewStudent }) {
  return (
    <div
      className="card card--elevated"
      style={{
        textAlign: 'center',
        padding: 'var(--space-12) var(--space-6)',
        marginTop: 'var(--space-4)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div style={{
        width: '64px',
        height: '64px',
        margin: '0 auto var(--space-4)',
        borderRadius: 'var(--r-lg)',
        background: 'var(--accent-subtle)',
        border: '1px solid var(--border-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '30px',
        boxShadow: '0 0 24px var(--accent-glow)'
      }}>
        📂
      </div>
      <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>
        No Students Registered
      </h2>
      <p style={{
        marginBottom: 'var(--space-6)',
        fontSize: '0.875rem',
        maxWidth: '320px',
        margin: '0 auto var(--space-6)',
        color: 'var(--text-secondary)'
      }}>
        Begin collecting facial metrics datasets by registering your first student.
      </p>
      <button
        id="empty-new-student-btn"
        className="btn btn--primary btn--lg"
        onClick={onNewStudent}
      >
        + Register First Student
      </button>
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
  if (status === 'complete') return <span className="badge badge--success">✓ Complete</span>
  if (status === 'in-progress') return <span className="badge badge--warning">◆ In Progress</span>
  return <span className="badge badge--muted">○ Pending</span>
}

export default function StudentList({
  onNewStudent,
  onRecaptureStudent,
}) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'complete' | 'pending'
  const [searchQuery, setSearchQuery] = useState('')
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
      <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="row" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Loading records…
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
        {/* Top Header Row */}
        <div className="row-between" style={{ marginBottom: 'var(--space-5)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '2px' }}>Student Datasets</h1>
            <p style={{ fontSize: '0.8125rem' }}>
              {students.length === 0
                ? 'Offline face capture queue'
                : `${completeCount} completed · ${pendingCount} pending`}
            </p>
          </div>
          <button
            id="new-student-btn"
            className="btn btn--primary btn--sm"
            onClick={onNewStudent}
          >
            + New Student
          </button>
        </div>

        {students.length === 0 ? (
          <EmptyState onNewStudent={onNewStudent} />
        ) : (
          <>
            {/* Search Bar */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <input
                id="search-students-input"
                type="text"
                className="form-input"
                placeholder="Search by name, Reg.No, email…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '10px 14px', fontSize: '0.875rem' }}
              />
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
                    No students match the current filter.
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
                        <span>{student.regNo}</span>
                        <span>•</span>
                        <span>{student.dept} - Sec {student.section}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="row" style={{ gap: 'var(--space-2)', flexShrink: 0 }}>
                      <StatusBadge status={student.status} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>›</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Phase 4 Export CTA Card */}
        {completeCount > 0 && (
          <div
            className="card"
            style={{
              marginTop: 'var(--space-6)',
              borderColor: 'var(--border-accent)',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(34,211,160,0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                📦 Export Ready
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {completeCount} validated student dataset{completeCount > 1 ? 's' : ''} ready for ZIP packaging.
              </div>
            </div>
            <button
              id="export-btn-placeholder"
              className="btn btn--primary btn--sm"
              disabled
              title="Full export engine will be activated in Phase 4"
            >
              Export ZIP
            </button>
          </div>
        )}
      </div>
    </>
  )
}
