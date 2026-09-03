const SALT = 'student_pwa_2026_srm_eec_v1_'
const EXPECTED_HASH = '21480904796c75debf61b1d0f743c6f47ec06018a8241b61542e14e91e09481f'
const AUTH_STORAGE_KEY = 'student_pwa_admin_token'

/**
 * Computes SHA-256 hash of salted passcode using Web Crypto API.
 */
export async function hashPasscode(passcode) {
  const encoder = new TextEncoder()
  const data = encoder.encode(SALT + passcode)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validates entered passcode against cryptographic hash.
 * Stores authenticated session token upon successful validation.
 */
export async function verifyAdminPasscode(passcode) {
  if (!passcode) return false
  const computed = await hashPasscode(passcode.toString().trim())
  const isValid = computed === EXPECTED_HASH
  if (isValid) {
    const sessionToken = btoa(`${Date.now()}_${computed.slice(0, 16)}`)
    sessionStorage.setItem(AUTH_STORAGE_KEY, sessionToken)
  }
  return isValid
}

/**
 * Checks if current browser session is authenticated as Admin.
 */
export function isAdminAuthenticated() {
  const token = sessionStorage.getItem(AUTH_STORAGE_KEY)
  return Boolean(token && token.length > 10)
}

/**
 * Clears admin session authentication.
 */
export function logoutAdmin() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}
