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
