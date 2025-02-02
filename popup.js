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
 * YOUTUBE HELPERS
 *****************************************/
function extractSongInfo(title) {
  // Remove common YouTube additions
  title = title
    .replace(/\(Official Video\)/i, '')
    .replace(/\(Official Music Video\)/i, '')
    .replace(/\[Official Video\]/i, '')
    .replace(/\(Lyric Video\)/i, '')
    .replace(/\(Audio\)/i, '')
    .replace(/\(Official Audio\)/i, '')
    .replace(/\[Official Audio\]/i, '')
    .replace(/\(Visualizer\)/i, '')
    .replace(/\(Official Visualizer\)/i, '')

  // Try to split artist and song if there's a dash
  const parts = title.split('-').map(part => part.trim())
  if (parts.length === 2) {
    return {
      artist: parts[0],
      song: parts[1]
    }
  }

  // If no dash, return the whole thing as the song title
  return {
    song: title.trim()
  }
}

/*****************************************
 * SPOTIFY API HELPERS
 *****************************************/
// Add this function to check token expiration
async function checkAndRefreshToken() {
  const { spotify_access_token, spotify_refresh_token, spotify_obtained_at, spotify_expires_in } = await chrome.storage.local.get(['spotify_access_token', 'spotify_refresh_token', 'spotify_obtained_at', 'spotify_expires_in'])

  // If no token exists, return null
  if (!spotify_access_token) {
    return null
  }

  // Calculate if token is expired (adding 60-second buffer)
  const expirationTime = spotify_obtained_at + spotify_expires_in * 1000
  const isExpired = Date.now() > expirationTime - 60000

  if (!isExpired) {
    return spotify_access_token
  }

  // Token is expired, try to refresh it
  if (spotify_refresh_token) {
    try {
      const clientId = '919c02efd25949419a943b749d5fd5ed'
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: spotify_refresh_token,
          client_id: clientId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const data = await response.json()

      // Store new tokens
      await chrome.storage.local.set({
        spotify_access_token: data.access_token,
        spotify_expires_in: data.expires_in,
        spotify_obtained_at: Date.now()
      })

      return data.access_token
    } catch (error) {
      console.error('Error refreshing token:', error)
      return null
    }
  }

  return null
}

// Modify your API helper functions to use the refreshed token
async function searchSpotify(query, token) {
  // Get fresh token
  const validToken = await checkAndRefreshToken()
  if (!validToken) {
    throw new Error('Not authenticated with Spotify')
  }

  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
    headers: {
      Authorization: `Bearer ${validToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to search Spotify')
  }

  return await response.json()
}

// Update getUserPlaylists and addToPlaylist similarly
async function getUserPlaylists() {
  const validToken = await checkAndRefreshToken()
  if (!validToken) {
    throw new Error('Not authenticated with Spotify')
  }

  const response = await fetch('https://api.spotify.com/v1/me/playlists', {
    headers: {
      Authorization: `Bearer ${validToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch playlists')
  }

  return await response.json()
}

async function addToPlaylist(playlistId, trackUri) {
  const validToken = await checkAndRefreshToken()
  if (!validToken) {
    throw new Error('Not authenticated with Spotify')
  }

  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${validToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: [trackUri]
    })
  })

  if (!response.ok) {
    throw new Error('Failed to add to playlist')
  }

  return await response.json()
}
/*****************************************
 * MAIN POPUP LOGIC
 *****************************************/
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn')
  const getCurrentSongBtn = document.getElementById('getCurrentSong')
  const songInfo = document.getElementById('songInfo')
  const songTitle = document.getElementById('songTitle')
  const searchResults = document.getElementById('searchResults')
  const saveToSpotifyBtn = document.getElementById('saveToSpotify')
  const statusDiv = document.getElementById('status')

  // Check if we're logged in
  chrome.storage.local.get('spotify_access_token', items => {
    if (items.spotify_access_token) {
      loginBtn.classList.add('hidden')
      getCurrentSongBtn.classList.remove('hidden')
    }
  })

  loginBtn.addEventListener('click', async () => {
    // 1. Generate PKCE codes
    const { codeVerifier, codeChallenge } = await generatePKCECodes()

    // 2. Store codeVerifier
    chrome.storage.local.set({ spotify_code_verifier: codeVerifier })

    // 3. Build authorization URL
    const clientId = '919c02efd25949419a943b749d5fd5ed'
    const redirectUri = 'https://als15.github.io/youtube-to-spotify-extension/callback'
    const scopes = 'user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-read-private'

    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('scope', scopes)

    // 4. Open authorization URL
    chrome.tabs.create({ url: authUrl.toString() })
  })

  getCurrentSongBtn.addEventListener('click', async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.url.includes('youtube.com/watch')) {
        throw new Error('Not a YouTube video page')
      }

      // Get video title
      const title = tab.title.replace('- YouTube', '').trim()
      const songInfo = extractSongInfo(title)

      // Display extracted info
      songTitle.textContent = `${songInfo.artist ? songInfo.artist + ' - ' : ''}${songInfo.song}`
      document.getElementById('songInfo').classList.remove('hidden')

      // Search on Spotify
      const token = (await chrome.storage.local.get('spotify_access_token')).spotify_access_token
      const searchQuery = songInfo.artist ? `${songInfo.artist} ${songInfo.song}` : songInfo.song

      const results = await searchSpotify(searchQuery, token)

      // Display search results
      searchResults.innerHTML = ''
      results.tracks.items.forEach(track => {
        const div = document.createElement('div')
        div.className = 'search-result'

        const titleP = document.createElement('p')
        titleP.innerHTML = `<strong>${track.name}</strong>`

        const artistP = document.createElement('p')
        artistP.textContent = `by ${track.artists.map(a => a.name).join(', ')}`

        const addButton = document.createElement('button')
        addButton.textContent = 'Add to Playlist'
        addButton.dataset.trackUri = track.uri
        addButton.addEventListener('click', async e => {
          const trackUri = e.target.dataset.trackUri
          await showPlaylistSelector(trackUri, token)
        })

        div.appendChild(titleP)
        div.appendChild(artistP)
        div.appendChild(addButton)
        searchResults.appendChild(div)
      })

      saveToSpotifyBtn.classList.remove('hidden')
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`
    }
  })

  async function showPlaylistSelector(trackUri, token) {
    try {
      const playlists = await getUserPlaylists(token)

      // Create playlist selection UI
      const playlistSelect = document.createElement('select')
      playlists.items.forEach(playlist => {
        const option = document.createElement('option')
        option.value = playlist.id
        option.textContent = playlist.name
        playlistSelect.appendChild(option)
      })

      // Add confirm button
      const confirmBtn = document.createElement('button')
      confirmBtn.textContent = 'Confirm'

      confirmBtn.addEventListener('click', async () => {
        try {
          await addToPlaylist(playlistSelect.value, trackUri, token)
          statusDiv.textContent = 'Song added to playlist successfully!'
        } catch (error) {
          statusDiv.textContent = `Error adding to playlist: ${error.message}`
        }
      })

      // Clear and update status div
      statusDiv.innerHTML = ''
      statusDiv.appendChild(playlistSelect)
      statusDiv.appendChild(confirmBtn)
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`
    }
  }
})
