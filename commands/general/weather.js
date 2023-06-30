const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { WEATHERSTACK_API_KEY } = process.env;

async function getWeather(location) {
    const fetch = await import('node-fetch');
    const response = await fetch.default(`http://api.weatherstack.com/current?access_key=${WEATHERSTACK_API_KEY}&query=${location}`);
    const data = await response.json();
    return `Actualmente son ${data.current.temperature} grados en ${location} y ${data.current.weather_descriptions[0]}`;
}

module.exports = { getWeather };
