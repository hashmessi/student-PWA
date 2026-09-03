import { useEffect, useRef } from 'react'

export default function QualityOverlay({
  qualityResult,
  expectedPose,
  holdProgress, // 0 to 1
  isCapturing,
  videoRef,
  facingMode = 'user',
}) {
  const canvasRef = useRef(null)

  const isReady = qualityResult && qualityResult.passed
  const reason = qualityResult ? qualityResult.reason : 'Align face with the oval guide'
  const currentYaw = qualityResult?.score?.yaw

  // Draw landmarks & bounding box
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Sync canvas internal resolution with actual video stream resolution
    if (videoRef?.current && videoRef.current.videoWidth > 0) {
      if (canvas.width !== videoRef.current.videoWidth) {
        canvas.width = videoRef.current.videoWidth
      }
      if (canvas.height !== videoRef.current.videoHeight) {
        canvas.height = videoRef.current.videoHeight
      }
    }

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!qualityResult || !qualityResult.box) return

    const box = qualityResult.box

    // Draw Face Bounding Box
    ctx.lineWidth = 2
    ctx.strokeStyle = isReady ? '#16a34a' : 'rgba(255, 255, 255, 0.45)'
    ctx.strokeRect(box.x, box.y, box.width, box.height)

    // Draw Landmark dots subtly
    if (qualityResult.landmarks && qualityResult.landmarks.length > 0) {
      ctx.fillStyle = isReady ? 'rgba(34, 197, 94, 0.9)' : 'rgba(255, 255, 255, 0.65)'
      qualityResult.landmarks.forEach(pt => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI)
        ctx.fill()
      })
    }
  }, [qualityResult, isReady, videoRef])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Canvas for Live Detection Box & Landmarks */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
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
          border: `2.5px ${isReady ? 'solid #16a34a' : 'dashed rgba(255,255,255,0.4)'}`,
          boxShadow: isReady
            ? '0 0 20px rgba(22, 163, 74, 0.4), inset 0 0 16px rgba(22, 163, 74, 0.15)'
            : '0 0 12px rgba(0,0,0,0.5)',
          transition: 'all var(--duration-fast) var(--ease-out)',
          position: 'relative'
        }}>
          {/* Subtle Crosshairs */}
          <div style={{ position: 'absolute', top: '-8px', left: '50%', width: '2px', height: '16px', background: isReady ? '#16a34a' : 'rgba(255,255,255,0.4)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', bottom: '-8px', left: '50%', width: '2px', height: '16px', background: isReady ? '#16a34a' : 'rgba(255,255,255,0.4)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '-8px', top: '50%', height: '2px', width: '16px', background: isReady ? '#16a34a' : 'rgba(255,255,255,0.4)', transform: 'translateY(-50%)' }} />
          <div style={{ position: 'absolute', right: '-8px', top: '50%', height: '2px', width: '16px', background: isReady ? '#16a34a' : 'rgba(255,255,255,0.4)', transform: 'translateY(-50%)' }} />
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
          borderRadius: 'var(--r-buttons)',
          background: 'rgba(0,0,0,0.6)',
          overflow: 'hidden',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.round(holdProgress * 100))}%`,
            background: '#16a34a',
            borderRadius: 'var(--r-buttons)',
            transition: 'width 80ms linear',
            boxShadow: '0 0 10px #16a34a'
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
          borderRadius: 'var(--r-buttons)',
          background: isReady ? 'rgba(10, 10, 10, 0.92)' : 'rgba(10, 10, 10, 0.88)',
          border: `1px solid ${isReady ? '#16a34a' : 'rgba(255, 255, 255, 0.2)'}`,
          backdropFilter: 'blur(12px)',
          color: isReady ? '#4ade80' : '#ffffff',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          textAlign: 'center',
          maxWidth: '92%'
        }}>
          <span style={{ fontSize: '14px' }}>
            {isReady ? '🟢' : '🟡'}
          </span>
          <span>
            {isReady
              ? `Ready (${currentYaw !== undefined ? `${currentYaw}°` : ''}) — Hold Still`
              : `${reason}${currentYaw !== undefined && Math.abs(currentYaw) > 2 ? ` [Yaw: ${currentYaw}°]` : ''}`}
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
