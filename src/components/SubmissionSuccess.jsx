export default function SubmissionSuccess({ student, onRegisterNext }) {
  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '65vh' }}>
      <div
        className="card"
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: '32px 24px',
          textAlign: 'center',
          animation: 'page-enter 0.25s var(--ease-out) both',
        }}
      >
        {/* Success Circle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-canvas)',
            border: '2px solid #16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: '#16a34a',
          }}>
            ✓
          </div>
        </div>

        <h1 style={{ fontSize: '1.5rem', marginBottom: '6px', color: 'var(--color-ink)' }}>
          Dataset Submitted!
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-mid-gray)', marginBottom: '20px' }}>
          Your 4 facial angle captures have been validated and saved to the offline Smart Attendance database.
        </p>

        {/* Student Summary Box */}
        {student && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--r-nested)',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-hairline)',
              marginBottom: '24px',
              textAlign: 'left',
            }}
          >
            <div className="row-between" style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)' }}>
                {student.name}
              </span>
              <span className="badge badge--success font-mono">
                ✓ 4/4 Verified
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-mid-gray)', fontFamily: 'var(--font-mono)' }}>
              {student.regNo} · Dept {student.dept} - Sec {student.section}
            </div>
          </div>
        )}

        <button
          id="register-next-student-btn"
          type="button"
          className="btn btn--primary btn--full btn--lg"
          onClick={onRegisterNext}
        >
          + Register Next Student
        </button>
      </div>
    </div>
  )
}
