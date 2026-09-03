import { createClient } from '@supabase/supabase-js'

const STORAGE_KEY_URL = 'student_pwa_supabase_url'
const STORAGE_KEY_ANON = 'student_pwa_supabase_anon_key'

/**
 * Formats user input into a complete Supabase HTTPS endpoint URL.
 * Accepts full URLs (https://xyz.supabase.co), domain names, or project ref IDs (yeikfafilyhqjcavzqov).
 */
export function normalizeSupabaseUrl(input) {
  if (!input) return ''
  let trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  if (trimmed.includes('.supabase.co')) {
    return `https://${trimmed}`
  }
  return `https://${trimmed}.supabase.co`
}

/**
 * Retrieves Supabase configuration from environment variables or localStorage.
 */
export function getSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  const localUrl = localStorage.getItem(STORAGE_KEY_URL) || ''
  const localAnon = localStorage.getItem(STORAGE_KEY_ANON) || ''

  const rawUrl = (localUrl || envUrl).trim()
  const url = normalizeSupabaseUrl(rawUrl)
  const anonKey = (localAnon || envAnon).trim()

  return { url, anonKey, rawUrl }
}

/**
 * Saves or updates custom Supabase credentials from UI settings.
 */
export function saveSupabaseConfig(url, anonKey) {
  if (url) {
    const cleanUrl = normalizeSupabaseUrl(url)
    localStorage.setItem(STORAGE_KEY_URL, cleanUrl)
  } else {
    localStorage.removeItem(STORAGE_KEY_URL)
  }

  if (anonKey) localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim())
  else localStorage.removeItem(STORAGE_KEY_ANON)

  supabaseClientInstance = null
}

/**
 * Checks if valid Supabase credentials are configured.
 */
export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig()
  return Boolean(url && anonKey && url.startsWith('http'))
}

let supabaseClientInstance = null

/**
 * Returns singleton Supabase client instance.
 */
export function getSupabase() {
  if (supabaseClientInstance) return supabaseClientInstance

  const { url, anonKey } = getSupabaseConfig()
  if (!url || !anonKey) return null

  try {
    supabaseClientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    return supabaseClientInstance
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err)
    return null
  }
}

/**
 * Tests connection to Supabase database.
 */
export async function testSupabaseConnection() {
  const client = getSupabase()
  if (!client) throw new Error('Supabase client not configured')

  const { error } = await client.from('students').select('reg_no').limit(1)
  if (error) throw error
  return true
}

/**
 * Uploads 4 photo blobs to 'student-faces' bucket and upserts record into 'students' table.
 */
export async function uploadStudentToSupabase(student, captures) {
  const client = getSupabase()
  if (!client) return { success: false, reason: 'Not configured' }

  const regNo = student.regNo.trim().toUpperCase()
  const photoUrls = {}
  const qualityScores = {}

  // 1. Upload each pose JPEG blob in parallel
  const uploadPromises = Object.entries(captures).map(async ([poseName, captureObj]) => {
    if (!captureObj || !captureObj.blob) return

    const filePath = `${regNo}/${poseName}.jpg`
    const { error: uploadError } = await client.storage
      .from('student-faces')
      .upload(filePath, captureObj.blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      console.warn(`Failed to upload ${poseName} to Supabase:`, uploadError)
    } else {
      const { data: publicUrlData } = client.storage
        .from('student-faces')
        .getPublicUrl(filePath)

      photoUrls[poseName] = publicUrlData?.publicUrl || filePath
      qualityScores[poseName] = captureObj.qualityScore || {}
    }
  })

  await Promise.all(uploadPromises)

  // 2. Upsert record into 'students' table
  const payload = {
    reg_no: regNo,
    name: student.name.trim(),
    dept: student.dept || 'IT',
    section: student.section || 'A',
    email: student.email || '',
    photo_urls: photoUrls,
    quality_scores: qualityScores,
    status: 'complete',
    device_info: navigator.userAgent || 'Unknown Device',
    updated_at: new Date().toISOString(),
  }

  const { error: dbError } = await client
    .from('students')
    .upsert(payload, { onConflict: 'reg_no' })

  if (dbError) {
    console.error('Supabase DB upsert error:', dbError)
    throw dbError
  }

  return { success: true, student: payload }
}

/**
 * Fetches all student records from Supabase 'students' table.
 */
export async function fetchStudentsFromSupabase() {
  const client = getSupabase()
  if (!client) return []

  const { data, error } = await client
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch students from Supabase:', error)
    throw error
  }

  return (data || []).map(row => ({
    regNo: row.reg_no,
    name: row.name,
    dept: row.dept,
    section: row.section,
    email: row.email,
    photoUrls: row.photo_urls || {},
    qualityScores: row.quality_scores || {},
    status: row.status || 'complete',
    createdAt: row.created_at,
    deviceInfo: row.device_info,
    isCloud: true,
  }))
}

/**
 * Deletes a student record and their images from Supabase.
 */
export async function deleteStudentFromSupabase(regNo) {
  const client = getSupabase()
  if (!client) return

  const cleanReg = regNo.trim().toUpperCase()

  // 1. Delete photo files
  const filesToDelete = [
    `${cleanReg}/front.jpg`,
    `${cleanReg}/left.jpg`,
    `${cleanReg}/right.jpg`,
    `${cleanReg}/overall.jpg`,
  ]

  await client.storage.from('student-faces').remove(filesToDelete)

  // 2. Delete row from table
  const { error } = await client.from('students').delete().eq('reg_no', cleanReg)
  if (error) throw error
}

/**
 * Downloads image blob from a public URL.
 */
export async function fetchImageBlob(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`)
  return await res.blob()
}
