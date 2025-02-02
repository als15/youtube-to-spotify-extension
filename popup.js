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
function extractSongInfo(title, channelName) {
  // Remove common YouTube additions
  title = title
    .replace(/\(Official Video\)/gi, '')
    .replace(/\(Official Music Video\)/gi, '')
    .replace(/\[Official Video\]/gi, '')
    .replace(/\(Lyric Video\)/gi, '')
    .replace(/\(Audio\)/gi, '')
    .replace(/\(Official Audio\)/gi, '')
    .replace(/\[Official Audio\]/gi, '')
    .replace(/\(Visualizer\)/gi, '')
    .replace(/\(Official Visualizer\)/gi, '')
    .replace(/\(Lyrics\)/gi, '')
    .replace(/\[Lyrics\]/gi, '')
    .replace(/\(HQ\)/gi, '')
    .replace(/\[HQ\]/gi, '')
    .replace(/\(HD\)/gi, '')
    .replace(/\[HD\]/gi, '')
    .trim()

  // Try to split artist and song if there's a dash
  const parts = title.split('-').map(part => part.trim())

  if (parts.length === 2) {
    return {
      artist: parts[0],
      song: parts[1],
      channelName
    }
  }

  // If no dash, try to use channel name as artist if it's not a VEVO channel
  if (channelName && !channelName.includes('VEVO')) {
    return {
      artist: channelName,
      song: title.trim(),
      channelName
    }
  }

  // If it's a VEVO channel, try to extract artist name from channel
  if (channelName && channelName.includes('VEVO')) {
    const artistName = channelName.replace('VEVO', '').trim()
    return {
      artist: artistName,
      song: title.trim(),
      channelName
    }
  }

  return {
    song: title.trim(),
    channelName
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

async function searchSpotify(query, youtubeInfo) {
  const validToken = await checkAndRefreshToken()
  if (!validToken) {
    throw new Error('Not authenticated with Spotify')
  }

  // If we have an artist, search with "artist:" prefix for better results
  const searchQuery = youtubeInfo.artist ? `artist:${youtubeInfo.artist} track:${youtubeInfo.song}` : query

  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=50`, {
    headers: {
      Authorization: `Bearer ${validToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to search Spotify')
  }

  const data = await response.json()
  return findBestMatch(data.tracks.items, youtubeInfo)
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
 * SPOTIFY MATCHING HELPER
 *****************************************/
function findBestMatch(tracks, youtubeInfo) {
  if (!tracks || tracks.length === 0 || !youtubeInfo.artist) return null

  // Clean strings for comparison
  const clean = str =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const youtubeArtist = clean(youtubeInfo.artist)
  const youtubeSong = clean(youtubeInfo.song)

  // First, filter tracks by artist name match
  const artistMatches = tracks.filter(track => track.artists.some(artist => clean(artist.name) === youtubeArtist))

  // If we have artist matches, find the best song title match among them
  if (artistMatches.length > 0) {
    const songMatches = artistMatches
      .map(track => ({
        track,
        similarity: clean(track.name) === youtubeSong ? 1 : 0
      }))
      .sort((a, b) => b.similarity - a.similarity)

    return songMatches[0].track
  }

  // If no exact artist match, return null
  return null
}

/*****************************************
 * MAIN POPUP LOGIC
 *****************************************/
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn')
  const getCurrentSongBtn = document.getElementById('getCurrentSong')
  const songInfo = document.getElementById('songInfo')
  const songTitle = document.getElementById('songTitle')
  const playlistSection = document.getElementById('playlistSection')
  const playlistSelect = document.getElementById('playlistSelect')
  const saveButton = document.getElementById('saveButton')
  const statusDiv = document.getElementById('status')
  const spinner = document.getElementById('spinner')

  let currentTrackUri = null

  // Check if we're logged in
  chrome.storage.local.get('spotify_access_token', items => {
    if (items.spotify_access_token) {
      loginBtn.classList.add('hidden')
      getCurrentSongBtn.classList.remove('hidden')
    }
  })

  loginBtn.addEventListener('click', async () => {
    const { codeVerifier, codeChallenge } = await generatePKCECodes()
    chrome.storage.local.set({ spotify_code_verifier: codeVerifier })

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

    chrome.tabs.create({ url: authUrl.toString() })
  })

  function showLoading() {
    spinner.classList.remove('hidden')
    getCurrentSongBtn.disabled = true
  }

  function hideLoading() {
    spinner.classList.add('hidden')
    getCurrentSongBtn.disabled = false
  }

  function showStatus(message, type = 'normal') {
    statusDiv.textContent = message
    switch (type) {
      case 'success':
        statusDiv.className = 'text-sm text-center min-h-8 text-[#1DB954]'
        break
      case 'error':
        statusDiv.className = 'text-sm text-center min-h-8 text-red-500'
        break
      default:
        statusDiv.className = 'text-sm text-center min-h-8 text-gray-400'
    }
    setTimeout(() => {
      statusDiv.textContent = ''
      statusDiv.className = 'text-sm text-center min-h-8 text-gray-400'
    }, 3000)
  }

  getCurrentSongBtn.addEventListener('click', async () => {
    try {
      showLoading()
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.url.includes('youtube.com/watch')) {
        throw new Error('Not a YouTube video page')
      }

      const { videoTitle, channelName } = await getYouTubeInfo(tab)
      const songInfo = extractSongInfo(videoTitle, channelName)

      const searchQuery = songInfo.artist ? `${songInfo.artist} ${songInfo.song}` : songInfo.song

      const token = await checkAndRefreshToken()
      if (!token) {
        throw new Error('Not authenticated with Spotify')
      }

      const match = await searchSpotify(searchQuery, songInfo)

      if (!match) {
        throw new Error('Could not find this song on Spotify')
      }

      songTitle.textContent = `${match.artists[0].name} - ${match.name}`
      document.getElementById('songInfo').classList.remove('hidden')

      const playlists = await getUserPlaylists()
      playlistSelect.innerHTML = ''
      playlists.items.forEach(playlist => {
        const option = document.createElement('option')
        option.value = playlist.id
        option.textContent = playlist.name
        playlistSelect.appendChild(option)
      })

      playlistSection.classList.remove('hidden')
      currentTrackUri = match.uri

      hideLoading()
    } catch (error) {
      hideLoading()
      showStatus(error.message, 'error')
    }
  })

  saveButton.addEventListener('click', async () => {
    if (!currentTrackUri || !playlistSelect.value) return

    try {
      saveButton.disabled = true
      saveButton.textContent = 'Saving...'

      const token = await checkAndRefreshToken()
      if (!token) {
        throw new Error('Not authenticated with Spotify')
      }

      await addToPlaylist(playlistSelect.value, currentTrackUri, token)
      showStatus('Added to playlist!', 'success')

      setTimeout(() => {
        songInfo.classList.add('hidden')
        playlistSection.classList.add('hidden')
        currentTrackUri = null
        saveButton.textContent = 'Save to Playlist'
      }, 2000)
    } catch (error) {
      showStatus(error.message, 'error')
    } finally {
      saveButton.disabled = false
      saveButton.textContent = 'Save to Playlist'
    }
  })

  async function getYouTubeInfo(tab) {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent || ''
        const channelName = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent || ''
        return { videoTitle, channelName }
      }
    })
    return result[0].result
  }
})
