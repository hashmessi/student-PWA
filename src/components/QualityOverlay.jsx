import { useEffect, useRef } from 'react'

export default function QualityOverlay({
  qualityResult,
  expectedPose,
  holdProgress, // 0 to 1
  isCapturing,
}) {
  const canvasRef = useRef(null)

  const isReady = qualityResult && qualityResult.passed
  const reason = qualityResult ? qualityResult.reason : 'Align face with the oval guide'

  // Draw landmarks & bounding box
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!qualityResult || !qualityResult.box) return

    const box = qualityResult.box

    // Draw Face Bounding Box with rounded corners
    ctx.lineWidth = 2
    ctx.strokeStyle = isReady ? '#22d3a0' : 'rgba(99, 102, 241, 0.6)'
    ctx.strokeRect(box.x, box.y, box.width, box.height)

    // Draw Landmark dots subtly
    if (qualityResult.landmarks && qualityResult.landmarks.length > 0) {
      ctx.fillStyle = isReady ? 'rgba(34, 211, 160, 0.7)' : 'rgba(129, 140, 248, 0.5)'
      qualityResult.landmarks.forEach(pt => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 1.8, 0, 2 * Math.PI)
        ctx.fill()
      })
    }
  }, [qualityResult, isReady])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Canvas for Live Detection Box & Landmarks */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)', // Match mirrored camera
        }}
      />

      {/* SVG Oval Target Guide */}
      <div style={{
        position: 'absolute',
        inset: '10%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: 'min(240px, 65vw)',
          height: 'min(310px, 80vw)',
          borderRadius: '50%',
          border: `2.5px ${isReady ? 'solid var(--success)' : 'dashed rgba(255,255,255,0.35)'}`,
          boxShadow: isReady
            ? '0 0 24px rgba(34, 211, 160, 0.4), inset 0 0 16px rgba(34, 211, 160, 0.15)'
            : '0 0 12px rgba(0,0,0,0.5)',
          transition: 'all var(--duration-normal) var(--ease-out)',
          position: 'relative'
        }}>
          {/* Subtle Crosshairs */}
          <div style={{ position: 'absolute', top: '-8px', left: '50%', width: '2px', height: '16px', background: isReady ? 'var(--success)' : 'rgba(255,255,255,0.4)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', bottom: '-8px', left: '50%', width: '2px', height: '16px', background: isReady ? 'var(--success)' : 'rgba(255,255,255,0.4)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '-8px', top: '50%', height: '2px', width: '16px', background: isReady ? 'var(--success)' : 'rgba(255,255,255,0.4)', transform: 'translateY(-50%)' }} />
          <div style={{ position: 'absolute', right: '-8px', top: '50%', height: '2px', width: '16px', background: isReady ? 'var(--success)' : 'rgba(255,255,255,0.4)', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {/* Stabilization Hold Progress Bar */}
      {holdProgress > 0 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '20px',
          right: '20px',
          height: '6px',
          borderRadius: 'var(--r-full)',
          background: 'rgba(0,0,0,0.5)',
          overflow: 'hidden',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.round(holdProgress * 100))}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--success))',
            borderRadius: 'var(--r-full)',
            transition: 'width 80ms linear',
            boxShadow: '0 0 10px var(--success)'
          }} />
        </div>
      )}

      {/* Floating Quality Status Feedback Badge */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '12px',
        right: '12px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          padding: '8px 16px',
          borderRadius: 'var(--r-full)',
          background: isReady ? 'rgba(7, 28, 20, 0.88)' : 'rgba(20, 18, 12, 0.88)',
          border: `1px solid ${isReady ? 'rgba(34, 211, 160, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
          backdropFilter: 'blur(12px)',
          color: isReady ? 'var(--success)' : '#fde047',
          fontSize: '0.8125rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          textAlign: 'center',
          maxWidth: '92%'
        }}>
          <span style={{ fontSize: '1rem' }}>
            {isReady ? '🟢' : '🟡'}
          </span>
          <span>
            {isReady ? 'Ready — Hold Still for Capture' : reason}
          </span>
        </div>
      </div>

      {/* Shutter Flash Animation */}
      {isCapturing && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#ffffff',
          animation: 'shutter-flash 0.35s ease-out forwards'
        }} />
      )}
    </div>
  )
}
