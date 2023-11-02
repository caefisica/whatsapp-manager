const { uploadImageToSupabase, insertLog } = require('../../db');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function openLibrary(sock, message, messageObject) {
    try {
        const messageType = Object.keys(message.message)[0];
        if (messageType !== 'imageMessage') {
            await sock.sendMessage(messageObject.from, { 
                text: `Please send an image as proof when opening the library.`
            });
            return;
        }

        const buffer = await downloadMediaMessage(message);
        const imageUrl = await uploadImageToSupabase(messageObject.sender, buffer);

        const logData = {
            timestamp: new Date().toISOString(),
            action: 'open',
            managerNumber: messageObject.sender,
            imageUrl
        };

        await insertLog('libraryAttendance', logData, data => data);

        await sock.sendMessage(messageObject.from, { 
            text: `¡La biblioteca se ha abierto! Gracias por tu colaboración.`
        });
    } catch (error) {
        await sock.sendMessage(messageObject.from, { 
            text: `Houston, tenemos un problema. Por favor, inténtalo de nuevo.`
        });
        console.log(error)
    }
}

async function closeLibrary(sock, message, messageObject) {
    try {
        const logData = {
            timestamp: new Date().toISOString(),
            action: 'close',
            managerNumber: messageObject.sender
        };

        await insertLog('libraryAttendance', logData, data => data);

        await sock.sendMessage(messageObject.from, { 
            text: `¡La biblioteca se ha cerrado! Gracias por tu colaboración.`
        });
    } catch (error) {
        await sock.sendMessage(messageObject.from, { 
            text: `Houston, tenemos un problema: ${error.message}`
        });
    }
}

module.exports = {
    openLibrary,
    closeLibrary
};
