const { openLibrary, closeLibrary } = require('./asistencia_colaboradores');
const { getLibraryStatus } = require('./status');

module.exports = {
    open: {
        handler: async function(sock, message, messageObject, args) {
            const responseText = await openLibrary(sock, message, messageObject);
            await sock.sendMessage(messageObject.from, {
              text: responseText,
            });
        },
    },
    close: {
        handler: async function(sock, message, messageObject, args) {
            const responseText = await closeLibrary(sock, message, messageObject);
            await sock.sendMessage(messageObject.from, {
              text: responseText,
            });
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
