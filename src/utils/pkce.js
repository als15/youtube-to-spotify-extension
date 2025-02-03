export function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let str = ''
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return str
}

export async function sha256ToBase64url(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const byteArray = Array.from(new Uint8Array(hashBuffer))
  let base64String = btoa(String.fromCharCode(...byteArray))
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function generatePKCECodes() {
  const codeVerifier = generateRandomString(64)
  const codeChallenge = await sha256ToBase64url(codeVerifier)
  return { codeVerifier, codeChallenge }
}
