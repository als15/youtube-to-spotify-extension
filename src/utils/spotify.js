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

// utils/spotify.js
export async function checkAndRefreshToken() {
  const { spotify_access_token, spotify_refresh_token, spotify_obtained_at, spotify_expires_in } = await chrome.storage.local.get(['spotify_access_token', 'spotify_refresh_token', 'spotify_obtained_at', 'spotify_expires_in'])

  if (!spotify_access_token) return null

  const expirationTime = spotify_obtained_at + spotify_expires_in * 1000
  const isExpired = Date.now() > expirationTime - 60000

  if (!isExpired) return spotify_access_token

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

      if (!response.ok) throw new Error('Failed to refresh token')

      const data = await response.json()

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

// utils/spotify.js
export async function searchSpotify(query, songInfo) {
  const token = await checkAndRefreshToken()
  if (!token) throw new Error('Not authenticated with Spotify')

  const searchQuery = songInfo.artist ? `artist:${songInfo.artist} track:${songInfo.song}` : query

  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=50`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to search Spotify')
  }

  const data = await response.json()
  return findBestMatch(data.tracks.items, songInfo)
}

export async function getUserPlaylists() {
  const token = await checkAndRefreshToken()
  if (!token) throw new Error('Not authenticated with Spotify')

  const response = await fetch('https://api.spotify.com/v1/me/playlists', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch playlists')
  }

  return await response.json()
}

export async function addToPlaylist(playlistId, trackUri) {
  const token = await checkAndRefreshToken()
  if (!token) throw new Error('Not authenticated with Spotify')

  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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

function findBestMatch(tracks, youtubeInfo) {
  if (!tracks || tracks.length === 0 || !youtubeInfo.artist) return null

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

  // If we have artist matches, find the best song title match
  if (artistMatches.length > 0) {
    const songMatches = artistMatches
      .map(track => ({
        track,
        similarity: clean(track.name) === youtubeSong ? 1 : 0
      }))
      .sort((a, b) => b.similarity - a.similarity)

    return songMatches[0].track
  }

  return null
}
