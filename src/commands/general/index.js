const { openLibrary, closeLibrary} = require('./asistencia_colaboradores');
const { getLibraryStatus } = require('./status');

module.exports = {
    open: {
        handler: async function(sock, message, messageObject, args) {
            openLibrary(sock, message, messageObject);
        },
    },
    close: {
        handler: async function(sock, message, messageObject, args) {
            closeLibrary(sock, message, messageObject);
        },
    },
    status: {
        handler: async function(sock, message, messageObject, args) {
            const responseText = await getLibraryStatus();
            await sock.sendMessage(messageObject.from, {
              text: responseText,
            });
        },
    },
};
