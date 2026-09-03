import * as faceapi from '@vladmandic/face-api'
import { calculateBrightness, calculateSharpness } from './imageProcessing'

let modelsLoaded = false
let loadingPromise = null
let sharedEvalCanvas = null
let sharedEvalCtx = null

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
 * - Negative values (< -12°): Head turned to student's LEFT (camera sensor right)
 * - Near zero (-12° to +12°): Head facing straight ahead
 * - Positive values (> +12°): Head turned to student's RIGHT (camera sensor left)
 * 
 * @param {Array<{x: number, y: number}>} landmarks 
 * @param {{x: number, y: number, width: number, height: number}} box 
 * @returns {number} Estimated yaw in degrees
 */
export function estimateYawAngle(landmarks, box) {
  if (!landmarks || landmarks.length < 68) {
    return 0
  }

  // Landmark indices (Dlib / face-api standard):
  // 0: camera-left jaw (student's right)
  // 16: camera-right jaw (student's left)
  // 30: nose tip
  // 36: camera-left eye outer
  // 45: camera-right eye outer
  const leftJaw = landmarks[0]
  const rightJaw = landmarks[16]
  const noseTip = landmarks[30]
  const leftEyeOuter = landmarks[36]
  const rightEyeOuter = landmarks[45]

  // Jaw asymmetry:
  // When turned to student's LEFT: noseTip.x moves toward rightJaw.x (large X in camera frame)
  // distToRightJaw decreases, distToLeftJaw increases -> asymmetry is NEGATIVE
  // When turned to student's RIGHT: noseTip.x moves toward leftJaw.x (small X in camera frame)
  // distToLeftJaw decreases, distToRightJaw increases -> asymmetry is POSITIVE
  const distToLeftJaw = Math.max(1, Math.abs(noseTip.x - leftJaw.x))
  const distToRightJaw = Math.max(1, Math.abs(rightJaw.x - noseTip.x))
  const totalJawDist = distToLeftJaw + distToRightJaw
  const jawAsymmetry = (distToRightJaw - distToLeftJaw) / (totalJawDist || 1)

  // Eye asymmetry (outer eye corner to nose tip distance):
  const distToLeftEye = Math.max(1, Math.abs(noseTip.x - leftEyeOuter.x))
  const distToRightEye = Math.max(1, Math.abs(rightEyeOuter.x - noseTip.x))
  const totalEyeDist = distToLeftEye + distToRightEye
  const eyeAsymmetry = (distToRightEye - distToLeftEye) / (totalEyeDist || 1)

  // Weighted blend: Jaw (65%) + Eye (35%)
  const combinedAsymmetry = jawAsymmetry * 0.65 + eyeAsymmetry * 0.35

  // Map asymmetry ratio (-0.8 to +0.8) to degrees (-60° to +60°)
  const estimatedYaw = combinedAsymmetry * 70

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
  if (!sharedEvalCanvas) {
    sharedEvalCanvas = document.createElement('canvas')
  }
  if (sharedEvalCanvas.width !== videoW || sharedEvalCanvas.height !== videoH) {
    sharedEvalCanvas.width = videoW
    sharedEvalCanvas.height = videoH
    sharedEvalCtx = sharedEvalCanvas.getContext('2d', { willReadFrequently: true })
  }
  const canvas = evalCanvas || sharedEvalCanvas
  const ctx = evalCanvas ? evalCanvas.getContext('2d', { willReadFrequently: true }) : sharedEvalCtx
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

    if (brightness < 25) {
      result.reason = 'Lighting too dark — improve lighting'
      return result
    }
    if (brightness > 252) {
      result.reason = 'Too bright / glare detected'
      return result
    }

    // Sharpness / Blur check
    const sharpness = Math.round(calculateSharpness(canvas, ctx, box))
    result.score.sharpness = sharpness

    if (sharpness < 10) {
      result.reason = 'Hold still — image blurry'
      return result
    }
  }

  // 5. Yaw / Head Pose Check per step
  const yaw = estimateYawAngle(result.landmarks, box)
  result.score.yaw = yaw

  switch (expectedPose) {
    case 'front':
      // Front neutral: yaw must be within [-16°, +16°]
      if (Math.abs(yaw) > 16) {
        result.reason = yaw > 16 ? 'Look straight (turn slightly left)' : 'Look straight (turn slightly right)'
        return result
      }
      break

    case 'left':
      // Left Profile: Turn head to expose LEFT cheek (yaw is negative: <= -8°)
      if (yaw > -8) {
        result.reason = 'Turn head to show your LEFT profile'
        return result
      }
      if (yaw < -68) {
        result.reason = 'Turned too far — angle ~45° for left profile'
        return result
      }
      break

    case 'right':
      // Right Profile: Turn head to expose RIGHT cheek (yaw is positive: >= +8°)
      if (yaw < 8) {
        result.reason = 'Turn head to show your RIGHT profile'
        return result
      }
      if (yaw > 68) {
        result.reason = 'Turned too far — angle ~45° for right profile'
        return result
      }
      break

    case 'overall':
      // Overall clear shot: look straight, neutral expression
      if (Math.abs(yaw) > 18) {
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
