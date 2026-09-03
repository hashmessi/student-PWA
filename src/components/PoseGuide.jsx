const POSES = [
  { id: 'front', label: 'Front', angle: '0°', icon: '👤', instruction: 'Look straight at camera with neutral expression' },
  { id: 'left', label: 'Left', angle: '45° ↰', icon: '👈', instruction: 'Turn head ~45° to your LEFT' },
  { id: 'right', label: 'Right', angle: '45° ↱', icon: '👉', instruction: 'Turn head ~45° to your RIGHT' },
  { id: 'overall', label: 'Overall', angle: 'Clear', icon: '✨', instruction: 'Straight-on clear shot with good lighting' },
]

export default function PoseGuide({ currentStep, capturedCount }) {
  const activePose = POSES[currentStep] || POSES[0]

  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      {/* 4-Step Progress Bar */}
      <div className="row" style={{ gap: '6px', marginBottom: 'var(--space-3)' }}>
        {POSES.map((pose, index) => {
          const isComplete = index < currentStep
          const isActive = index === currentStep

          return (
            <div
              key={pose.id}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 'var(--r-md)',
                background: isActive
                  ? 'var(--accent-subtle)'
                  : isComplete
                  ? 'var(--success-subtle)'
                  : 'var(--bg-elevated)',
                border: `1px solid ${
                  isActive
                    ? 'var(--border-accent)'
                    : isComplete
                    ? 'rgba(34,211,160,0.3)'
                    : 'var(--border-subtle)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                transition: 'all var(--duration-normal) var(--ease-out)',
                boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem' }}>
                  {isComplete ? '✓' : pose.icon}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: isActive ? 'var(--accent-hover)' : isComplete ? 'var(--success)' : 'var(--text-muted)'
                }}>
                  {pose.label}
                </span>
              </div>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {pose.angle}
              </span>
            </div>
          )
        })}
      </div>

      {/* Active Pose Instruction Banner */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--r-md)',
          background: 'linear-gradient(135deg, var(--accent-subtle), rgba(99,102,241,0.25))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0
        }}>
          {activePose.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-hover)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Step {currentStep + 1} of 4 · {activePose.label} Pose
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
            {activePose.instruction}
          </div>
        </div>
      </div>
    </div>
  )
}
