// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Installed')
})

let accessToken = null // Will store the Spotify access token

// Function to initiate the authentication process
function authenticateWithSpotify() {
  const clientId = '919c02efd25949419a943b749d5fd5ed' // Replace with your actual Client ID
  const redirectUri = 'chrome-extension://miplddhmffnopdbdminoddijjaeablfg/*'
  const scopes = ['playlist-modify-public', 'playlist-modify-private', 'user-library-modify', 'user-library-read']

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}
&response_type=token
&redirect_uri=${encodeURIComponent(redirectUri)}
&scope=${encodeURIComponent(scopes.join(' '))}`

  // Open the auth URL in a new tab or window
  chrome.tabs.create({ url: authUrl })
}

// Listen for messages from popup.js to start authentication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    authenticateWithSpotify()
  }

  if (request.action === 'saveToken') {
    // Save the token from the redirect
    accessToken = request.token
    console.log('Spotify Access Token Saved:', accessToken)
  }

  sendResponse({ status: 'ok' })
})
