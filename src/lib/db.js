import { openDB } from 'idb'

const DB_NAME = 'FaceCaptureDB'
const DB_VERSION = 1

let dbPromise = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Student metadata store — keyed by regNo
        if (!db.objectStoreNames.contains('studentMeta')) {
          const metaStore = db.createObjectStore('studentMeta', { keyPath: 'regNo' })
          metaStore.createIndex('section', 'section', { unique: false })
          metaStore.createIndex('dept', 'dept', { unique: false })
          metaStore.createIndex('capturedAt', 'capturedAt', { unique: false })
        }

        // Photo blobs store — keyed by "regNo_pose" (e.g. "21IT001_front")
        if (!db.objectStoreNames.contains('photoBlobs')) {
          const photoStore = db.createObjectStore('photoBlobs', { keyPath: 'id' })
          photoStore.createIndex('regNo', 'regNo', { unique: false })
        }
      },
    })
  }
  return dbPromise
}

/**
 * Check if a regNo already exists in IndexedDB.
 * @param {string} regNo
 * @returns {Promise<{exists: boolean, isComplete: boolean, student: object|null}>}
 */
export async function checkRegNo(regNo) {
  if (!regNo) return { exists: false, isComplete: false, student: null }
  const db = await getDb()
  const student = await db.get('studentMeta', regNo.toUpperCase())
  if (!student) return { exists: false, isComplete: false, student: null }
  return {
    exists: true,
    isComplete: student.status === 'complete',
    student,
  }
}

/**
 * Save or update student metadata record.
 * status: 'pending' | 'in-progress' | 'complete'
 */
export async function saveStudent(studentData) {
  const db = await getDb()
  const record = {
    ...studentData,
    regNo: studentData.regNo.toUpperCase(),
    updatedAt: new Date().toISOString(),
    status: studentData.status || 'pending',
  }
  await db.put('studentMeta', record)
  return record
}

/**
 * Atomically saves both the student metadata and all 4 photo blobs in a single transaction.
 * @param {object} studentData 
 * @param {object} capturesMap { front, left, right, overall }
 */
export async function saveStudentCompleteDataset(studentData, capturesMap) {
  const db = await getDb()
  const tx = db.transaction(['studentMeta', 'photoBlobs'], 'readwrite')
  const metaStore = tx.objectStore('studentMeta')
  const photoStore = tx.objectStore('photoBlobs')

  const regNo = studentData.regNo.toUpperCase()
  const poses = ['front', 'left', 'right', 'overall']
  const imagesMeta = {}

  for (const pose of poses) {
    const item = capturesMap[pose]
    if (item && item.blob) {
      const blobId = `${regNo}_${pose}`
      await photoStore.put({
        id: blobId,
        regNo,
        pose,
        blob: item.blob,
        dataUrl: item.dataUrl || null,
        width: item.width || 720,
        height: item.height || 720,
        qualityScore: item.qualityScore || {},
        capturedAt: item.capturedAt || new Date().toISOString(),
      })
      imagesMeta[pose] = `${pose}.jpg`
    }
  }

  const updatedRecord = {
    ...studentData,
    regNo,
    status: 'complete',
    capturedAt: new Date().toISOString(),
    images: imagesMeta,
    qualityChecksPassed: true,
  }

  await metaStore.put(updatedRecord)
  await tx.done

  return updatedRecord
}

/**
 * Retrieves all 4 photos for a given student from photoBlobs store.
 * Returns map: { front: { blob, dataUrl, ... }, left: ..., right: ..., overall: ... }
 * @param {string} regNo 
 */
export async function getStudentPhotos(regNo) {
  if (!regNo) return {}
  const normalizedRegNo = regNo.toUpperCase()
  const db = await getDb()
  const tx = db.transaction('photoBlobs', 'readonly')
  const store = tx.objectStore('photoBlobs')

  const poses = ['front', 'left', 'right', 'overall']
  const result = {}

  for (const pose of poses) {
    const key = `${normalizedRegNo}_${pose}`
    const record = await store.get(key)
    if (record) {
      // Ensure dataUrl is available (create from Blob if needed)
      let dataUrl = record.dataUrl
      if (!dataUrl && record.blob) {
        dataUrl = URL.createObjectURL(record.blob)
      }
      result[pose] = {
        ...record,
        dataUrl,
      }
    }
  }

  await tx.done
  return result
}

/**
 * Get all student records, sorted by regNo.
 */
export async function getAllStudents() {
  const db = await getDb()
  const all = await db.getAll('studentMeta')
  return all.sort((a, b) => a.regNo.localeCompare(b.regNo))
}

/**
 * Get a single student by regNo.
 */
export async function getStudent(regNo) {
  if (!regNo) return null
  const db = await getDb()
  return db.get('studentMeta', regNo.toUpperCase())
}

/**
 * Delete a student and all their photo blobs (admin function).
 */
export async function deleteStudent(regNo) {
  const normalizedRegNo = regNo.toUpperCase()
  const db = await getDb()
  const tx = db.transaction(['studentMeta', 'photoBlobs'], 'readwrite')
  await tx.objectStore('studentMeta').delete(normalizedRegNo)

  // Delete all 4 pose photos
  const poses = ['front', 'left', 'right', 'overall']
  for (const pose of poses) {
    await tx.objectStore('photoBlobs').delete(`${normalizedRegNo}_${pose}`)
  }
  await tx.done
}

/**
 * Returns database metrics and photo storage counts.
 */
export async function getDatabaseStats() {
  const db = await getDb()
  const allStudents = await db.getAll('studentMeta')
  const completeCount = allStudents.filter(s => s.status === 'complete').length
  const photoKeys = await db.getAllKeys('photoBlobs')

  return {
    totalStudents: allStudents.length,
    completeDatasets: completeCount,
    pendingDatasets: allStudents.length - completeCount,
    totalPhotos: photoKeys.length,
  }
}

/**
 * Creates a synthetic 720x720 biometric canvas image blob for demo purposes.
 * Styled as clinical blueprint on paper per DESIGN.md.
 */
function createDemoFaceBlob(name, regNo, poseTitle, yawDirection = 0) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 720
    const ctx = canvas.getContext('2d')

    // Background paper
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, 720, 720)

    // Blueprint grid lines
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)'
    ctx.lineWidth = 1
    for (let x = 40; x < 720; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 720)
      ctx.stroke()
    }
    for (let y = 40; y < 720; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(720, y)
      ctx.stroke()
    }

    // Oval Guide Outline
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(360, 340, 160, 220, 0, 0, 2 * Math.PI)
    ctx.stroke()

    // Face Silhouette
    const offsetX = yawDirection * 45
    ctx.fillStyle = 'rgba(15, 23, 42, 0.05)'
    ctx.beginPath()
    ctx.ellipse(360 + offsetX, 340, 145, 195, 0, 0, 2 * Math.PI)
    ctx.fill()

    // Biometric Features (Eyes, Nose, Mouth) in Ink
    ctx.fillStyle = '#0a0a0a'
    // Eyes
    ctx.beginPath()
    ctx.arc(315 + offsetX, 310, 8, 0, 2 * Math.PI)
    ctx.arc(405 + offsetX, 310, 8, 0, 2 * Math.PI)
    ctx.fill()

    // Pupils
    ctx.fillStyle = '#171717'
    ctx.beginPath()
    ctx.arc(315 + offsetX + (yawDirection * 3), 310, 4, 0, 2 * Math.PI)
    ctx.arc(405 + offsetX + (yawDirection * 3), 310, 4, 0, 2 * Math.PI)
    ctx.fill()

    // Nose bridge
    ctx.strokeStyle = '#404040'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(360 + offsetX, 320)
    ctx.lineTo(360 + offsetX + (yawDirection * 8), 365)
    ctx.lineTo(352 + offsetX, 370)
    ctx.stroke()

    // Mouth
    ctx.strokeStyle = '#0a0a0a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(360 + offsetX, 415, 22, 0.1 * Math.PI, 0.9 * Math.PI)
    ctx.stroke()

    // Target Crosshairs
    ctx.strokeStyle = '#171717'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(350, 340); ctx.lineTo(370, 340)
    ctx.moveTo(360, 330); ctx.lineTo(360, 350)
    ctx.stroke()

    // Technical Watermark Header & Footer
    ctx.fillStyle = '#0a0a0a'
    ctx.font = '600 20px "Geist", "Inter", sans-serif'
    ctx.fillText(`${name} (${regNo})`, 36, 56)

    ctx.font = '600 13px "Geist Mono", monospace'
    ctx.fillStyle = '#16a34a'
    ctx.fillText(`BIOMETRIC POSE: ${poseTitle.toUpperCase()}`, 36, 82)

    ctx.fillStyle = '#737373'
    ctx.font = '12px "Geist Mono", monospace'
    ctx.fillText('STANDARDIZED: 720×720 @ 85% · YAW ESTIMATION PASSED', 36, 680)

    canvas.toBlob((blob) => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ blob, dataUrl, width: 720, height: 720 })
    }, 'image/jpeg', 0.85)
  })
}

/**
 * Seeds realistic sample students with complete 4-pose photo datasets for testing.
 */
export async function seedDemoStudents() {
  const demoList = [
    {
      regNo: '310625205065',
      name: 'Dhanush',
      dept: 'IT',
      section: 'A',
      email: '310625205065@eec.srmrmp.edu.in',
      status: 'complete',
    },
    {
      regNo: '310625205100',
      name: 'Hashvanth M U',
      dept: 'IT',
      section: 'B',
      email: '310625205100@eec.srmrmp.edu.in',
      status: 'complete',
    },
    {
      regNo: '310625205001',
      name: 'Aarav Sharma',
      dept: 'IT',
      section: 'A',
      email: '310625205001@eec.srmrmp.edu.in',
      status: 'pending',
    },
  ]

  for (const student of demoList) {
    if (student.status === 'complete') {
      const front = await createDemoFaceBlob(student.name, student.regNo, 'Front Pose (0°)', 0)
      const left = await createDemoFaceBlob(student.name, student.regNo, 'Left Pose (~45°)', -1)
      const right = await createDemoFaceBlob(student.name, student.regNo, 'Right Pose (~45°)', 1)
      const overall = await createDemoFaceBlob(student.name, student.regNo, 'Overall Clear', 0)

      await saveStudentCompleteDataset(student, { front, left, right, overall })
    } else {
      await saveStudent(student)
    }
  }

  return demoList
}

/**
 * Clears all records from IndexedDB (for development/reset).
 */
export async function clearAllStudents() {
  const db = await getDb()
  const tx = db.transaction(['studentMeta', 'photoBlobs'], 'readwrite')
  await tx.objectStore('studentMeta').clear()
  await tx.objectStore('photoBlobs').clear()
  await tx.done
}

