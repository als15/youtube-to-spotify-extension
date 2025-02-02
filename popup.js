/*****************************************
 * PKCE HELPER FUNCTIONS
 *****************************************/
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let str = ''
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return str
}

async function sha256ToBase64url(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convert ArrayBuffer to string
  const byteArray = Array.from(new Uint8Array(hashBuffer))
  let base64String = btoa(String.fromCharCode(...byteArray))

  // Base64-url encode
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generatePKCECodes() {
  const codeVerifier = generateRandomString(64)
  const codeChallenge = await sha256ToBase64url(codeVerifier)
  return { codeVerifier, codeChallenge }
}

/*****************************************
 * MAIN POPUP LOGIC
 *****************************************/
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn')
  const profileBtn = document.getElementById('profileBtn')
  const statusDiv = document.getElementById('status')

  loginBtn.addEventListener('click', async () => {
    // 1. Generate PKCE codeVerifier & codeChallenge
    const { codeVerifier, codeChallenge } = await generatePKCECodes()

    // 2. Store codeVerifier in chrome.storage to retrieve in background.js
    chrome.storage.local.set({ spotify_code_verifier: codeVerifier }, () => {
      console.log('PKCE codeVerifier stored in chrome.storage.')
    })

    // 3. Build the Spotify /authorize URL
    const clientId = '919c02efd25949419a943b749d5fd5ed' // Replace with your real client ID
    const redirectUri = 'https://als15.github.io/youtube-to-spotify-extension/callback' // Must match in Spotify Dashboard
    const scopes = 'user-read-private user-read-email' // Example scopes; add more if needed

    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('scope', scopes)

    // 4. Open in a new tab
    chrome.tabs.create({ url: authUrl.toString() })
  })

  // Example: fetch user profile from Spotify
  profileBtn.addEventListener('click', async () => {
    chrome.storage.local.get('spotify_access_token', async items => {
      const token = items.spotify_access_token
      if (!token) {
        statusDiv.textContent = 'No access token found. Please log in first.'
        return
      }

      try {
        const resp = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!resp.ok) {
          const errText = await resp.text()
          throw new Error(`Error fetching profile: ${errText}`)
        }
        const profile = await resp.json()
        statusDiv.textContent = `User Profile:\n${JSON.stringify(profile, null, 2)}`
      } catch (err) {
        statusDiv.textContent = `Error: ${err.message}`
      }
    })
  })
})
