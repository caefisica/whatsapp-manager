const axios = require('axios');
const queryString = require('query-string');
require('dotenv').config({ path: '../../.env' })

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

let accessToken = null;
let tokenTimestamp = null;

async function getAccessToken() {
    if (accessToken && tokenTimestamp && (Date.now() - tokenTimestamp < 3600000)) {
        return accessToken;
    }

    const response = await axios.post('https://accounts.spotify.com/api/token', queryString.stringify({
        'grant_type': 'client_credentials',
        'client_id': client_id,
        'client_secret': client_secret
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    accessToken = response.data.access_token;
    tokenTimestamp = Date.now();

    return accessToken;
}

async function searchTrack(trackName, token) {
  const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(trackName)}&type=track&limit=5&market=PE`, {
      headers: {
          'Authorization': `Bearer ${token}`
      }
  });

  let previewUrl = null;
  let trackFoundName = null;
  let artistFoundName = null;

  for (let item of response.data.tracks.items) {
      if (item.preview_url) {
          previewUrl = item.preview_url;
          trackFoundName = item.name;
          artistFoundName = item.artists[0].name;
          break;
      }
  }

  return { previewUrl, trackFoundName, artistFoundName };
}

module.exports = {
    getAccessToken,
    searchTrack
};
