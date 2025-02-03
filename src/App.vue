<template>
  <div class="container">
    <!-- Login Button -->
    <button v-if="!isLoggedIn" @click="login" class="btn-spotify">
      <SpotifyIcon />
      <span>Login with Spotify</span>
    </button>

    <!-- Get Current Song Button -->
    <button v-if="isLoggedIn && !currentSong" @click="getCurrentSong" class="btn-spotify" :disabled="isLoading">
      <MusicIcon />
      <span>Get Current Song</span>
      <Spinner v-if="isLoading" />
    </button>

    <!-- Song Info -->
    <div v-if="currentSong" class="song-info slide-down">
      <div class="song-title">
        <MusicIcon />
        <span>{{ currentSong.artist }} - {{ currentSong.name }}</span>
      </div>
    </div>

    <!-- Playlist Section -->
    <div v-if="currentSong" class="playlist-section slide-down">
      <select v-model="selectedPlaylist" class="playlist-select">
        <option disabled value="">Select a playlist</option>
        <option v-for="playlist in playlists" :key="playlist.id" :value="playlist.id">
          {{ playlist.name }}
        </option>
      </select>

      <button @click="saveToPlaylist" class="save-button" :disabled="!selectedPlaylist || isSaving">
        {{ isSaving ? 'Saving...' : 'Save to Playlist' }}
      </button>
    </div>

    <!-- Status Message -->
    <div v-if="statusMessage" :class="['status', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SpotifyIcon from './components/SpotifyIcon.vue'
import MusicIcon from './components/MusicIcon.vue'
import Spinner from './components/Spinner.vue'
import { generatePKCECodes } from './utils/pkce'
import { checkAndRefreshToken, searchSpotify, getUserPlaylists, addToPlaylist } from './utils/spotify'
import { extractSongInfo } from './utils/youtube'

const isLoggedIn = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)
const currentSong = ref(null)
const playlists = ref([])
const selectedPlaylist = ref('')
const statusMessage = ref('')
const statusType = ref('normal')

// Check login status on mount
onMounted(async () => {
  const token = await checkAndRefreshToken()
  isLoggedIn.value = !!token
})

function showStatus(message, type = 'normal') {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
    statusType.value = 'normal'
  }, 3000)
}

async function login() {
  try {
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
  } catch (error) {
    showStatus(error.message, 'error')
  }
}

async function getCurrentSong() {
  try {
    isLoading.value = true
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab.url.includes('youtube.com/watch')) {
      throw new Error('Not a YouTube video page')
    }

    const { videoTitle, channelName } = await getYouTubeInfo(tab)
    const songInfo = extractSongInfo(videoTitle, channelName)

    const searchQuery = songInfo.artist ? `${songInfo.artist} ${songInfo.song}` : songInfo.song

    const match = await searchSpotify(searchQuery, songInfo)

    if (!match) {
      throw new Error('Could not find this song on Spotify')
    }

    currentSong.value = {
      uri: match.uri,
      name: match.name,
      artist: match.artists[0].name
    }

    // Get playlists
    const userPlaylists = await getUserPlaylists()
    playlists.value = userPlaylists.items
  } catch (error) {
    showStatus(error.message, 'error')
  } finally {
    isLoading.value = false
  }
}

async function saveToPlaylist() {
  if (!currentSong.value || !selectedPlaylist.value) return

  try {
    isSaving.value = true
    await addToPlaylist(selectedPlaylist.value, currentSong.value.uri)
    showStatus('Added to playlist!', 'success')

    // Reset after successful save
    setTimeout(() => {
      currentSong.value = null
      selectedPlaylist.value = ''
    }, 2000)
  } catch (error) {
    showStatus(error.message, 'error')
  } finally {
    isSaving.value = false
  }
}

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
</script>

<style>
/* Global styles */
:root {
  --spotify-green: #1db954;
  --spotify-green-hover: #1ed760;
  --spotify-black: #121212;
  --spotify-dark-gray: #282828;
  --spotify-light-gray: #b3b3b3;
  --spotify-error: #ff4444;
}

body {
  width: 320px;
  margin: 0;
  font-family: 'Inter', sans-serif;
  background-color: var(--spotify-black);
  color: white;
}

/* Container */
.container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Spotify Button */
.btn-spotify {
  width: 100%;
  background-color: var(--spotify-green);
  color: white;
  border: none;
  border-radius: 24px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.btn-spotify:hover:not(:disabled) {
  background-color: var(--spotify-green-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn-spotify:disabled {
  background-color: var(--spotify-dark-gray);
  cursor: not-allowed;
  transform: none;
}

/* Song Info */
.song-info {
  background-color: var(--spotify-dark-gray);
  border-radius: 8px;
  padding: 16px;
}

.song-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

/* Playlist Section */
.playlist-select {
  width: 100%;
  padding: 12px;
  background-color: var(--spotify-dark-gray);
  color: white;
  border: 1px solid #404040;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 12px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

.playlist-select:focus {
  outline: none;
  border-color: var(--spotify-green);
}

.save-button {
  width: 100%;
  background-color: var(--spotify-green);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.save-button:hover:not(:disabled) {
  background-color: var(--spotify-green-hover);
}

.save-button:disabled {
  background-color: var(--spotify-dark-gray);
  cursor: not-allowed;
}

/* Status Message */
.status {
  font-size: 14px;
  text-align: center;
  color: var(--spotify-light-gray);
  min-height: 20px;
}

.status.success {
  color: var(--spotify-green);
}

.status.error {
  color: var(--spotify-error);
}

/* Animations */
.slide-down {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hidden {
  display: none !important;
}
</style>
