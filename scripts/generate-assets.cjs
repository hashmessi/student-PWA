const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function createPNG(size) {
  // Generate RGBA raw image data
  // Background: #0f0f14 (15, 15, 20, 255)
  // Accent gradient circle / icon in center: #6366f1 (99, 102, 241)
  const width = size
  const height = size
  const rawData = Buffer.alloc(height * (1 + width * 4))

  const cx = width / 2
  const cy = height / 2
  const radius = width * 0.4

  let offset = 0
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0 // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= radius) {
        // Center icon area - Electric Indigo gradient
        const factor = (y / height)
        const r = Math.round(99 + (129 - 99) * factor)
        const g = Math.round(102 + (140 - 102) * factor)
        const b = Math.round(241 + (248 - 241) * factor)
        rawData[offset++] = r
        rawData[offset++] = g
        rawData[offset++] = b
        rawData[offset++] = 255
      } else {
        // Dark background
        rawData[offset++] = 15
        rawData[offset++] = 15
        rawData[offset++] = 20
        rawData[offset++] = 255
      }
    }
  }

  const deflated = zlib.deflateSync(rawData)

  function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i]
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
      }
    }
    return (c ^ 0xffffffff) >>> 0
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const typeAndData = Buffer.concat([typeBuf, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typeAndData), 0)
    return Buffer.concat([len, typeAndData, crc])
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type (RGBA)
  ihdr[10] = 0 // compression method
  ihdr[11] = 0 // filter method
  ihdr[12] = 0 // interlace method

  const ihdrChunk = makeChunk('IHDR', ihdr)
  const idatChunk = makeChunk('IDAT', deflated)
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons')
const modelsDir = path.join(__dirname, '..', 'public', 'models')

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true })

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPNG(192))
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPNG(512))
fs.writeFileSync(path.join(modelsDir, '.gitkeep'), '')

console.log('Icons and models folder generated successfully.')
