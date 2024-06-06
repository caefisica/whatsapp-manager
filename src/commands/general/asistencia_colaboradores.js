const { uploadImageToSupabase, insertLog } = require("../../db");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

async function processLibraryAction(sock, message, messageObject, action) {
    try {
        let imageUrl = null;
        const messageType = Object.keys(message.message)[0];

        if (
            (action === "open" || action === "close") &&
            messageType !== "imageMessage"
        ) {
            return "Por favor envía una foto de la biblioteca para confirmar tu ingreso/salida.";
        }

        if (messageType === "imageMessage") {
            const buffer = await downloadMediaMessage(message);
            imageUrl = await uploadImageToSupabase(
                messageObject.sender,
                buffer
            );
        }

        const logData = {
            timestamp: new Date().toISOString(),
            action: action,
            managerNumber: messageObject.senderNumber,
            imageUrl,
        };

        await insertLog("libraryAttendance", logData, data => data);

        return `¡La biblioteca se ha ${action === "open" ? "abierto" : "cerrado"}! Gracias por tu colaboración.`;
    } catch (error) {
        let errorMessage = "Houston, tenemos un problema.";
        /*
        if (error.message) {
            errorMessage += `: ${error.message}`;
        }
        */
        console.error(error);
        return errorMessage;
    }
}

async function openLibrary(sock, message, messageObject) {
    const responseText = await processLibraryAction(
        sock,
        message,
        messageObject,
        "open"
    );
    return responseText;
}

async function closeLibrary(sock, message, messageObject) {
    const responseText = await processLibraryAction(
        sock,
        message,
        messageObject,
        "close"
    );
    return responseText;
}

module.exports = {
    openLibrary,
    closeLibrary,
};
