const axios = require('axios');
const queryString = require('query-string');
require('dotenv').config({ path: '../../.env' })

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

console.log('We are using the following Spotify credentials:');
console.log(`Client ID: ${client_id}`);
console.log(`Client Secret: ${client_secret}`);

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
    const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(trackName)}&type=track&limit=1`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log('The track name is:', trackName)
    console.log('The response is:', response.data.tracks.items)

    if (response.data.tracks.items.length > 0) {
        return response.data.tracks.items[0].preview_url;
    } else {
        return null;
    }
}

module.exports = {
    getAccessToken,
    searchTrack
};
