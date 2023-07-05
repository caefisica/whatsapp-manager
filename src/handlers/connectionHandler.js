const {
    DisconnectReason,
} = require('@adiwajshing/baileys');
const { start } = require('../app');
const { 
    myNumberWithJid,
    MAX_RETRIES,
} = require('../config/constants');

const { dropAuth } = require('../utils/reload');

// Statistics
let startCount = 1;

// Restart behavior
let retryCount = 0;

function handleConnectionUpdate(sock) {
    return async (update) => {
        const { connection, lastDisconnect } = update;
        const isStatusCodeLogout = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        const shouldReconnect = lastDisconnect?.error && !isStatusCodeLogout;

        try {
            switch (connection) {
            case 'open':
                console.log('[LOG] El bot está listo para usar');
                retryCount = 0; // Reset retry count on successful connection
                await sock.sendMessage(myNumberWithJid, {
                    text: `[INICIO] - ${startCount}`,
                });
                break;
            case 'close':
                if (shouldReconnect) {
                    if (retryCount < MAX_RETRIES) {
                        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff delay
                        console.log(`[ALERTA] La conexión fue CERRADA ${lastDisconnect.error}, reintentando en ${delay/1000} segundos...`);
                        retryCount++;
                        startCount++;
                        setTimeout(start, delay);
                    } else {
                        console.error('[PROBLEMA] Se ha superado el número máximo de reintentos. Reinicie el bot manualmente');
                    }
                } else {
                    console.log('[PROBLEMA] Estás desconectado. Prepárate para escanear el código QR');
                    await dropAuth();
                    startCount++; // increment startCount as bot is attempting to reconnect
                    setTimeout(start, 1000 * 5);
                }
                break;
            default:
                console.log('[LOG] Este evento de actualización es desconocido:', update);
                break;
            }
        } catch (error) {
            console.error('Error en connection.update', error, update);
        }
    };
}

module.exports = {
    handleConnectionUpdate,
};