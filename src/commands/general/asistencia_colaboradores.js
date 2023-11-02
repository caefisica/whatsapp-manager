const { uploadImageToSupabase, insertLog } = require('../../db');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function processLibraryAction(sock, message, messageObject, action) {
    try {
        let imageUrl = null;
        const messageType = Object.keys(message.message)[0];

        if (action === 'open' && messageType !== 'imageMessage') {
            throw new Error('Please send an image as proof when opening the library.');
        }

        if (messageType === 'imageMessage') {
            const buffer = await downloadMediaMessage(message);
            imageUrl = await uploadImageToSupabase(messageObject.sender, buffer);
        }

        const logData = {
            timestamp: new Date().toISOString(),
            action: action,
            managerNumber: messageObject.sender,
            imageUrl
        };

        await insertLog('libraryAttendance', logData, data => data);

        let successMessage = `¡La biblioteca se ha ${action === 'open' ? 'abierto' : 'cerrado'}! Gracias por tu colaboración.`;
        await sock.sendMessage(messageObject.from, { text: successMessage });
    } catch (error) {
        let errorMessage = `Houston, tenemos un problema. Por favor, inténtalo de nuevo.`;
        if (error.message) {
            errorMessage += `: ${error.message}`;
        }
        await sock.sendMessage(messageObject.from, { text: errorMessage });
        console.log(error);
    }
}

function openLibrary(sock, message, messageObject) {
    return processLibraryAction(sock, message, messageObject, 'open');
}

function closeLibrary(sock, message, messageObject) {
    return processLibraryAction(sock, message, messageObject, 'close');
}

module.exports = {
    openLibrary,
    closeLibrary
};
