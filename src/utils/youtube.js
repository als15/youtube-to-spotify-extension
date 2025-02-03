// utils/youtube.js
export function extractSongInfo(title, channelName) {
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
