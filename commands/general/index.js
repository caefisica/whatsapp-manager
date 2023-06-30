module.exports = {
    translate: {
        handler: async function(sock, message, messageObject, args) {
            const { translateText } = require('./translate');
            const text = args.join(' ');
            const translatedText = await translateText(text, 'en');
            await sock.sendMessage(messageObject.sender, { text: translatedText });
        },
    },
    weather: {
        handler: async function(sock, message, messageObject, args) {
            const { getWeather } = require('./weather');
            const city = args.join(' ');
            const weather = await getWeather(city);
            if (weather) {
                await sock.sendMessage(messageObject.sender, { text: `Current weather in ${city}: ${weather}` });
            } else {
                await sock.sendMessage(messageObject.sender, { text: `Sorry, could not fetch weather for ${city}` });
            }
        }
    },
    sticker: {
        handler: async function(sock, message, messageObject, args) {
            const { handler: makeSticker } = require('./sticker');
            await makeSticker(sock, message, messageObject, args);
        }
    },
};
