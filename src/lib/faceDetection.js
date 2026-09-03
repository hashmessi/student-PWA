import * as faceapi from '@vladmandic/face-api'
import { calculateBrightness, calculateSharpness } from './imageProcessing'

let modelsLoaded = false
let loadingPromise = null

/**
 * Loads face detection and landmark models from local /models directory.
 */
export async function loadFaceModels(modelsPath = '/models') {
  if (modelsLoaded) return true
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelsPath),
      ])
      modelsLoaded = true
      return true
    } catch (err) {
      console.warn('Failed to load tiny landmarks, attempting standard landmark model:', err)
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelsPath),
        ])
        modelsLoaded = true
        return true
      } catch (fallbackErr) {
        console.error('Failed to load face detection models:', fallbackErr)
        throw fallbackErr
      }
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

/**
 * Estimates head yaw angle (degrees) from 68 face landmark points.
 * - Negative values (< -15°): Head turned to student's LEFT (camera right)
 * - Near zero (-12° to +12°): Head facing straight ahead
 * - Positive values (> +15°): Head turned to student's RIGHT (camera left)
 * 
 * @param {Array<{x: number, y: number}>} landmarks 
 * @param {{x: number, y: number, width: number, height: number}} box 
 * @returns {number} Estimated yaw in degrees
 */
export function estimateYawAngle(landmarks, box) {
  if (!landmarks || landmarks.length < 68) {
    return 0
  }

  const leftJaw = landmarks[0]   // Student's right, camera left
  const rightJaw = landmarks[16] // Student's left, camera right
  const noseTip = landmarks[30]
  const leftEyeOuter = landmarks[36]
  const rightEyeOuter = landmarks[45]

  // Distance from nose to left/right jaw edges
  const distToLeftJaw = Math.abs(noseTip.x - leftJaw.x)
  const distToRightJaw = Math.abs(rightJaw.x - noseTip.x)
  const totalJawDist = distToLeftJaw + distToRightJaw

  if (totalJawDist === 0) return 0

  // Distance from nose to each eye
  const distToLeftEye = Math.abs(noseTip.x - leftEyeOuter.x)
  const distToRightEye = Math.abs(rightEyeOuter.x - noseTip.x)
  const eyeRatio = distToLeftEye / (distToRightEye || 1)

  // Asymmetry ratio: 0.5 is centered. > 0.5 means turned right; < 0.5 means turned left.
  const asymmetry = (distToRightJaw - distToLeftJaw) / totalJawDist

  // Scale asymmetry to approximate degree angle (-60° to +60°)
  let estimatedYaw = asymmetry * 75

  // Refine using eye distances
  if (eyeRatio > 1.8) {
    estimatedYaw = Math.max(estimatedYaw, 25)
  } else if (eyeRatio < 0.55) {
    estimatedYaw = Math.min(estimatedYaw, -25)
  }

  return Math.round(estimatedYaw)
}

/**
 * Runs single frame detection on a live video stream.
 * @param {HTMLVideoElement} videoElement 
 */
export async function detectFacesInVideo(videoElement) {
  if (!modelsLoaded || !videoElement || videoElement.readyState < 2) {
    return []
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  })

  try {
    const detections = await faceapi
      .detectAllFaces(videoElement, options)
      .withFaceLandmarks(true)

    return detections
  } catch (err) {
    console.error('Detection error:', err)
    return []
  }
}

/**
 * Evaluates all 5 quality gates against the current detection & video frame.
 * 
 * @param {Array<object>} detections Array of faceapi detection results
 * @param {HTMLVideoElement} videoElement 
 * @param {'front' | 'left' | 'right' | 'overall'} expectedPose 
 * @param {HTMLCanvasElement} [evalCanvas] Optional offscreen canvas for pixel checks
 * @returns {{
 *   passed: boolean,
 *   reason: string | null,
 *   score: { faceCount: number, yaw: number, brightness: number, sharpness: number, sizePercent: number },
 *   box: { x: number, y: number, width: number, height: number } | null,
 *   landmarks: Array<any> | null
 * }}
 */
export function evaluateQualityGates(detections, videoElement, expectedPose = 'front', evalCanvas) {
  const result = {
    passed: false,
    reason: null,
    score: {
      faceCount: detections.length,
      yaw: 0,
      brightness: 0,
      sharpness: 0,
      sizePercent: 0,
    },
    box: null,
    landmarks: null,
  }

  // 1. Single Face Check (Reject 0 or >1)
  if (detections.length === 0) {
    result.reason = 'Position face within the oval guide'
    return result
  }

  if (detections.length > 1) {
    result.reason = 'Multiple faces detected — isolate 1 student'
    return result
  }

  const det = detections[0]
  const box = det.detection.box
  const videoW = videoElement.videoWidth || videoElement.width || 640
  const videoH = videoElement.videoHeight || videoElement.height || 480

  result.box = { x: box.x, y: box.y, width: box.width, height: box.height }
  result.landmarks = det.landmarks ? det.landmarks.positions : null

  // 2. Face Size Check (Occupies 18% to 75% of video frame width)
  const sizePercent = Math.round((box.width / videoW) * 100)
  result.score.sizePercent = sizePercent

  if (sizePercent < 18) {
    result.reason = 'Move closer to the camera'
    return result
  }

  if (sizePercent > 78) {
    result.reason = 'Move slightly further back'
    return result
  }

  // 3. Centering Check (Face center within central 65% of frame)
  const faceCenterX = box.x + box.width / 2
  const faceCenterY = box.y + box.height / 2
  const minX = videoW * 0.15
  const maxX = videoW * 0.85
  const minY = videoH * 0.10
  const maxY = videoH * 0.90

  if (faceCenterX < minX || faceCenterX > maxX || faceCenterY < minY || faceCenterY > maxY) {
    result.reason = 'Center face inside the oval'
    return result
  }

  // 4. Pixel-level checks: Brightness & Sharpness via Canvas
  const canvas = evalCanvas || document.createElement('canvas')
  canvas.width = videoW
  canvas.height = videoH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(videoElement, 0, 0, videoW, videoH)

  // Brightness check
  const sx = Math.max(0, Math.floor(box.x))
  const sy = Math.max(0, Math.floor(box.y))
  const sw = Math.min(videoW - sx, Math.floor(box.width))
  const sh = Math.min(videoH - sy, Math.floor(box.height))

  if (sw > 10 && sh > 10) {
    const faceImageData = ctx.getImageData(sx, sy, sw, sh)
    const brightness = Math.round(calculateBrightness(faceImageData))
    result.score.brightness = brightness

    if (brightness < 45) {
      result.reason = 'Lighting too dark — improve lighting'
      return result
    }
    if (brightness > 240) {
      result.reason = 'Too bright / glare detected'
      return result
    }

    // Sharpness / Blur check
    const sharpness = Math.round(calculateSharpness(canvas, ctx, box))
    result.score.sharpness = sharpness

    if (sharpness < 25) {
      result.reason = 'Hold still — image blurry'
      return result
    }
  }

  // 5. Yaw / Head Pose Check per step
  const yaw = estimateYawAngle(result.landmarks, box)
  result.score.yaw = yaw

  switch (expectedPose) {
    case 'front':
      // Front neutral: yaw must be within [-15°, +15°]
      if (Math.abs(yaw) > 16) {
        result.reason = yaw > 16 ? 'Look straight (turn slightly left)' : 'Look straight (turn slightly right)'
        return result
      }
      break

    case 'left':
      // Subject turns head ~45° to THEIR LEFT (camera yaw < -15°)
      if (yaw > -14) {
        result.reason = 'Turn head ~45° to your LEFT'
        return result
      }
      if (yaw < -55) {
        result.reason = 'Turned too far — angle ~45° left'
        return result
      }
      break

    case 'right':
      // Subject turns head ~45° to THEIR RIGHT (camera yaw > +15°)
      if (yaw < 14) {
        result.reason = 'Turn head ~45° to your RIGHT'
        return result
      }
      if (yaw > 55) {
        result.reason = 'Turned too far — angle ~45° right'
        return result
      }
      break

    case 'overall':
      // Overall clear shot: look straight, high clarity
      if (Math.abs(yaw) > 16) {
        result.reason = 'Look directly at camera for final shot'
        return result
      }
      break

    default:
      break
  }

  // All quality gates passed!
  result.passed = true
  result.reason = null
  return result
}
