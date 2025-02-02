// background.js (Manifest V3 service worker)

// 1. Intercept tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Wait until the URL changes and includes "https://example.com/callback"
  if (changeInfo.url && changeInfo.url.startsWith('https://example.com/callback')) {
    const url = new URL(changeInfo.url)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    // Immediately remove the tab so the user doesn't see an error page
    chrome.tabs.remove(tabId)

    if (error) {
      console.error('Spotify authorization error:', error)
      return
    }

    if (!code) {
      console.log('No code found in URL. Possibly user cancelled or error occurred.')
      return
    }

    // 2. Retrieve the codeVerifier we stored
    const { spotify_code_verifier } = await new Promise(resolve => {
      chrome.storage.local.get('spotify_code_verifier', resolve)
    })
    if (!spotify_code_verifier) {
      console.error('No PKCE codeVerifier found in chrome.storage.')
      return
    }

    // 3. Exchange the code + codeVerifier -> tokens
    try {
      const tokenData = await exchangeCodeForTokens(code, spotify_code_verifier)
      // { access_token, refresh_token, expires_in, scope, token_type }

      // 4. Store tokens
      await new Promise(resolve => {
        chrome.storage.local.set(
          {
            spotify_access_token: tokenData.access_token,
            spotify_refresh_token: tokenData.refresh_token, // If provided
            spotify_expires_in: tokenData.expires_in,
            spotify_obtained_at: Date.now()
          },
          resolve
        )
      })

      console.log('Spotify tokens stored successfully in chrome.storage.')
    } catch (err) {
      console.error('Error exchanging code for tokens:', err.message)
    }
  }
})

// A helper to call POST /api/token with code + codeVerifier
async function exchangeCodeForTokens(code, codeVerifier) {
  const clientId = '919c02efd25949419a943b749d5fd5ed' // same as used in popup
  const redirectUri = 'https://als15.github.io/youtube-to-spotify-extension/callback.html'

  // Build request body
  const body = new URLSearchParams()
  body.append('grant_type', 'authorization_code')
  body.append('code', code)
  body.append('redirect_uri', redirectUri)
  body.append('client_id', clientId)
  body.append('code_verifier', codeVerifier)

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error('Token request failed: ' + errorText)
  }

  return await response.json() // e.g. { access_token, token_type, scope, expires_in, refresh_token }
}
