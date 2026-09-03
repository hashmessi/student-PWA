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
          db.createObjectStore('photoBlobs', { keyPath: 'id' })
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
 * Save or update a student record.
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
