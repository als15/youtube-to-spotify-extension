/****************************
 *  PKCE HELPER FUNCTIONS
 ****************************/
function generateRandomString(length) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

// base64-urlencode (RFC 4648 §5)
function base64URLEncode(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// SHA-256 hashing
async function sha256(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return await crypto.subtle.digest('SHA-256', data)
}

/**
 * generatePKCECodes - returns { codeVerifier, codeChallenge }
 */
async function generatePKCECodes() {
  const codeVerifier = generateRandomString(64)
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64URLEncode(hashed)
  return { codeVerifier, codeChallenge }
}

/****************************
 *  MAIN EXTENSION LOGIC
 ****************************/

// Replace this with your actual client ID and redirect URI
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'
const REDIRECT_URI = 'https://<your-username>.github.io/my-spotify-callback/callback.html'
// or e.g. "https://myapp.vercel.app/callback.html"

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn')
  const profileBtn = document.getElementById('profileBtn')
  const profileResult = document.getElementById('profileResult')

  loginBtn.addEventListener('click', () => {
    // Step 1: Generate PKCE codeVerifier and codeChallenge
    generatePKCECodes().then(({ codeVerifier, codeChallenge }) => {
      // Step 2: Store the codeVerifier in chrome.storage for retrieval after redirect
      chrome.storage.local.set({ spotify_code_verifier: codeVerifier }, () => {
        console.log('Stored codeVerifier in chrome.storage.')

        // Step 3: Build the Spotify /authorize URL
        const state = generateRandomString(16) // optional, can store to verify
        const scope = ['playlist-modify-public', 'playlist-modify-private', 'user-library-modify', 'user-library-read'].join(' ')

        const authUrl = new URL('https://accounts.spotify.com/authorize')
        authUrl.searchParams.append('client_id', CLIENT_ID)
        authUrl.searchParams.append('response_type', 'code')
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
        authUrl.searchParams.append('code_challenge_method', 'S256')
        authUrl.searchParams.append('code_challenge', codeChallenge)
        authUrl.searchParams.append('scope', scope)
        authUrl.searchParams.append('state', state) // optional

        // Step 4: Open the authUrl in a new window or tab
        window.open(authUrl.toString(), 'SpotifyAuth', 'width=600,height=800')
      })
    })
  })

  // Listen for postMessage from callback.html
  window.addEventListener('message', event => {
    if (event.data?.type === 'SPOTIFY_TOKEN') {
      const { access_token, refresh_token, expires_in } = event.data.data
      console.log('Received tokens from callback page:', {
        access_token,
        refresh_token,
        expires_in
      })

      // Step 5: Store tokens in chrome.storage
      chrome.storage.local.set(
        {
          spotify_access_token: access_token,
          spotify_refresh_token: refresh_token,
          spotify_expires_in: expires_in,
          spotify_obtained_at: Date.now()
        },
        () => {
          alert('Spotify authentication succeeded! Access token stored.')
        }
      )
    }
  })

  // Example: Use the stored token to get user profile from Spotify
  profileBtn.addEventListener('click', () => {
    chrome.storage.local.get(['spotify_access_token', 'spotify_refresh_token', 'spotify_expires_in', 'spotify_obtained_at'], items => {
      const { spotify_access_token } = items
      if (!spotify_access_token) {
        profileResult.textContent = 'No access token found. Please log in first.'
        return
      }

      // Example: Call https://api.spotify.com/v1/me
      fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${spotify_access_token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch profile: ' + res.status)
          return res.json()
        })
        .then(data => {
          profileResult.textContent = `User Profile:\n${JSON.stringify(data, null, 2)}`
        })
        .catch(err => {
          profileResult.textContent = `Error: ${err.message}`
        })
    })
  })
})
