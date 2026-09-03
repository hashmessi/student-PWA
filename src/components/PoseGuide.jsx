const POSES = [
  { id: 'front', label: 'Front', angle: '0° Gaze', icon: '👤', instruction: 'Look straight at camera with neutral expression' },
  { id: 'left', label: 'Left', angle: 'Left Profile', icon: '👈', instruction: 'Turn head to show your LEFT profile (left cheek)' },
  { id: 'right', label: 'Right', angle: 'Right Profile', icon: '👉', instruction: 'Turn head to show your RIGHT profile (right cheek)' },
  { id: 'overall', label: 'Clarity', angle: '720×720', icon: '✨', instruction: 'Straight-on clear shot with good lighting' },
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
                borderRadius: 'var(--r-buttons)',
                background: isActive
                  ? 'var(--color-ink)'
                  : isComplete
                  ? 'var(--color-surface-alt)'
                  : 'var(--color-paper)',
                border: `1px solid ${
                  isActive
                    ? 'var(--color-ink)'
                    : 'var(--color-hairline)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                transition: 'all var(--duration-fast) var(--ease-out)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: isActive ? '#ffffff' : isComplete ? '#16a34a' : 'var(--color-mid-gray)' }}>
                  {isComplete ? '✓' : pose.icon}
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isActive ? '#ffffff' : isComplete ? 'var(--color-ink)' : 'var(--color-mid-gray)'
                }}>
                  {pose.label}
                </span>
              </div>
              <span style={{
                fontSize: '10px',
                color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-mid-gray)',
                fontFamily: 'var(--font-mono)'
              }}>
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
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--r-buttons)',
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0
        }}>
          {activePose.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-mid-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Step {currentStep + 1} of 4 · {activePose.label} Pose
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '2px' }}>
            {activePose.instruction}
          </div>
        </div>
      </div>
    </div>
  )
}
