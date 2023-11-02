const { openLibrary, closeLibrary } = require('./asistencia_colaboradores');
const { getLibraryStatus } = require('./status');
const { getTodayImageDescriptions } = require('./../../db');

module.exports = {
    abierto: {
        handler: async function(sock, message, messageObject, args) {
            const responseText = await openLibrary(sock, message, messageObject);
            await sock.sendMessage(messageObject.from, {
              text: responseText,
            });
        },
    },
    cerrado: {
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
    revisar: {
        handler: async function(sock, message, messageObject, args) {
            try {
                const imagesData = await getTodayImageDescriptions();

                if (imagesData && imagesData.length > 0) {
                    for (const data of imagesData) {
                        await sock.sendMessage(messageObject.from, {
                            image: { url: data.imageUrl },
                            caption: data.description,
                        });
                    }
                } else {
                    await sock.sendMessage(messageObject.from, {
                        text: "No se encontraron imágenes para hoy.",
                    });
                }
            } catch (error) {
                await sock.sendMessage(messageObject.from, {
                    text: "Hubo un error al obtener las imágenes.",
                });
                console.error(error);
            }
        }
    }
};
