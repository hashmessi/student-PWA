/**
 * Image processing utilities for Face Capture quality gates & 720x720 standardization.
 */

/**
 * Calculates average brightness (luminance) from ImageData.
 * @param {ImageData} imageData 
 * @returns {number} 0 (pitch black) to 255 (pure white)
 */
export function calculateBrightness(imageData) {
  const data = imageData.data
  let totalLuminance = 0
  const pixelCount = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    // Standard perceptual luminance formula
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b
  }

  return totalLuminance / pixelCount
}

/**
 * Calculates sharpness score using variance of Laplacian on a grayscale patch.
 * Higher score = sharper image; lower score (< 35) = blurry / out of focus.
 * @param {HTMLCanvasElement} canvas 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {{ x: number, y: number, width: number, height: number }} box 
 * @returns {number} Laplacian variance score
 */
export function calculateSharpness(canvas, ctx, box) {
  // Clamp box within canvas dimensions
  const sx = Math.max(0, Math.floor(box.x))
  const sy = Math.max(0, Math.floor(box.y))
  const sw = Math.min(canvas.width - sx, Math.floor(box.width))
  const sh = Math.min(canvas.height - sy, Math.floor(box.height))

  if (sw <= 10 || sh <= 10) return 0

  // Downsample patch to max 120x120 for fast real-time compute
  const targetW = Math.min(120, sw)
  const targetH = Math.min(120, sh)

  const patchCanvas = document.createElement('canvas')
  patchCanvas.width = targetW
  patchCanvas.height = targetH
  const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true })
  
  patchCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, targetW, targetH)
  const imgData = patchCtx.getImageData(0, 0, targetW, targetH)
  const pixels = imgData.data

  // Convert to grayscale
  const gray = new Float32Array(targetW * targetH)
  for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
    gray[j] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
  }

  // Laplacian 3x3 kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  let laplacianSum = 0
  let laplacianSqSum = 0
  let count = 0

  for (let y = 1; y < targetH - 1; y++) {
    for (let x = 1; x < targetW - 1; x++) {
      const idx = y * targetW + x
      const lap =
        gray[idx - targetW] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx + targetW] -
        4 * gray[idx]

      laplacianSum += lap
      laplacianSqSum += lap * lap
      count++
    }
  }

  if (count === 0) return 0
  const mean = laplacianSum / count
  const variance = (laplacianSqSum / count) - (mean * mean)

  return Math.max(0, variance)
}

/**
 * Crops a balanced square portrait centered around the face bounding box,
 * scales it to 720x720, and exports as JPEG Blob and DataURL.
 * 
 * @param {HTMLVideoElement | HTMLCanvasElement} source 
 * @param {{ x: number, y: number, width: number, height: number }} box 
 * @param {number} targetSize default 720
 * @param {number} quality default 0.85
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 */
export async function cropAndCompressFaceImage(source, box, targetSize = 720, quality = 0.85) {
  const sourceWidth = source.videoWidth || source.width
  const sourceHeight = source.videoHeight || source.height

  // If no valid box, fallback to centered square crop
  let cropX, cropY, cropSize

  if (box && box.width > 20 && box.height > 20) {
    const faceCenterX = box.x + box.width / 2
    // Place eye-level / face center slightly above mid-point (42%)
    const faceCenterY = box.y + box.height * 0.45

    // Margin around face: 1.6x the maximum face dimension
    const desiredSize = Math.max(box.width, box.height) * 1.6
    cropSize = Math.min(desiredSize, sourceWidth, sourceHeight)

    cropX = Math.max(0, Math.min(sourceWidth - cropSize, faceCenterX - cropSize / 2))
    cropY = Math.max(0, Math.min(sourceHeight - cropSize, faceCenterY - cropSize / 2))
  } else {
    cropSize = Math.min(sourceWidth, sourceHeight)
    cropX = (sourceWidth - cropSize) / 2
    cropY = (sourceHeight - cropSize) / 2
  }

  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = targetSize
  exportCanvas.height = targetSize
  const exportCtx = exportCanvas.getContext('2d', { alpha: false })

  // Clean high quality rendering
  exportCtx.imageSmoothingEnabled = true
  exportCtx.imageSmoothingQuality = 'high'

  exportCtx.drawImage(
    source,
    cropX, cropY, cropSize, cropSize,
    0, 0, targetSize, targetSize
  )

  const dataUrl = exportCanvas.toDataURL('image/jpeg', quality)

  const blob = await new Promise((resolve) => {
    exportCanvas.toBlob(
      (b) => resolve(b),
      'image/jpeg',
      quality
    )
  })

  return {
    blob,
    dataUrl,
    width: targetSize,
    height: targetSize,
  }
}
