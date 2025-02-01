// popup.js

// DOM Elements
const youtubeLinkInput = document.getElementById('youtubeLink')
const playlistsDropdown = document.getElementById('spotifyPlaylists')
const addToPlaylistBtn = document.getElementById('addToPlaylistBtn')
const favoriteBtn = document.getElementById('favoriteBtn')

// We'll store the token here after receiving it from background.js
let accessToken = null

// 1. Request authentication if no token is available
// In a real scenario, you would check chrome.storage or message background.js
// to see if an accessToken was already saved. For simplicity:
function checkAuthentication() {
  // Request the background page for the current accessToken
  chrome.runtime.sendMessage({ action: 'getToken' }, response => {
    if (response && response.token) {
      accessToken = response.token
      // If we have a token, let's load the user's playlists
      fetchPlaylists()
    } else {
      // Ask user to authenticate
      if (confirm('You need to authenticate with Spotify. Proceed?')) {
        chrome.runtime.sendMessage({ action: 'authenticate' })
      }
    }
  })
}

// 2. Fetch user playlists
function fetchPlaylists() {
  fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
    .then(response => response.json())
    .then(data => {
      // Populate dropdown
      data.items.forEach(playlist => {
        const option = document.createElement('option')
        option.value = playlist.id
        option.textContent = playlist.name
        playlistsDropdown.appendChild(option)
      })
    })
    .catch(err => console.error('Error fetching playlists:', err))
}

// 3. Extract a search term from the YouTube link
// Real implementation might use YouTube Data API to get the title.
// For demonstration, let's assume the user inputs a search-friendly text or partial title.
function getSearchTermFromYouTubeLink(link) {
  // Very naive approach: user might have typed the exact song name in the link box
  // You can enhance this using YouTube Data API or regex, etc.
  return link
}

// 4. Search Spotify for the track
function searchSpotifyTrack(query) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
    .then(response => response.json())
    .then(data => {
      if (data.tracks.items.length > 0) {
        return data.tracks.items[0] // Return the first match
      } else {
        throw new Error('No track found on Spotify for that query.')
      }
    })
}

// 5. Add track to a selected playlist
function addTrackToPlaylist(trackId, playlistId) {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify:track:${trackId}`
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error('Error adding track to playlist.')
    }
    return response.json()
  })
}

// 6. Mark a track as favorite (Add to 'Liked Songs')
function favoriteTrack(trackId) {
  const url = 'https://api.spotify.com/v1/me/tracks'
  return fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ids: [trackId]
    })
  }).then(response => {
    if (!response.ok) {
      throw new Error('Error marking track as favorite.')
    }
    return response
  })
}

// Event listeners for buttons
addToPlaylistBtn.addEventListener('click', () => {
  const youtubeLink = youtubeLinkInput.value.trim()
  const selectedPlaylist = playlistsDropdown.value

  if (!youtubeLink) {
    alert('Please enter a YouTube link or search query.')
    return
  }

  if (!selectedPlaylist) {
    alert('Please select a playlist.')
    return
  }

  const searchTerm = getSearchTermFromYouTubeLink(youtubeLink)

  searchSpotifyTrack(searchTerm)
    .then(track => {
      return addTrackToPlaylist(track.id, selectedPlaylist).then(() => {
        alert(`Song "${track.name}" added to playlist successfully.`)
      })
    })
    .catch(err => alert(err.message))
})

favoriteBtn.addEventListener('click', () => {
  const youtubeLink = youtubeLinkInput.value.trim()
  if (!youtubeLink) {
    alert('Please enter a YouTube link or search query.')
    return
  }

  const searchTerm = getSearchTermFromYouTubeLink(youtubeLink)

  searchSpotifyTrack(searchTerm)
    .then(track => {
      return favoriteTrack(track.id).then(() => {
        alert(`Song "${track.name}" marked as favorite.`)
      })
    })
    .catch(err => alert(err.message))
})

// Initialize on popup load
document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication()
})
