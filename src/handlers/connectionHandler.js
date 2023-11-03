const {
    DisconnectReason,
} = require('@whiskeysockets/baileys');
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

async function handleReconnection(reason) {
    switch (reason) {
    case DisconnectReason.badSession:
        console.log('[PROBLEMA] Archivo de sesión corrupto, por favor elimine la sesión y escanee de nuevo.');
        await dropAuth();
        startCount++;
        setTimeout(start, 1000 * 5);
        break;
    case DisconnectReason.loggedOut:
    case DisconnectReason.connectionClosed:
    case DisconnectReason.connectionLost:
    case DisconnectReason.connectionReplaced:
    case DisconnectReason.restartRequired:
    case DisconnectReason.timedOut:
        console.log(`[PROBLEMA] Desconectado: ${reason}. Reconectando...`);
        if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            retryCount++;
            startCount++;
            setTimeout(start, delay);
        } else {
            console.error('[PROBLEMA] Se ha superado el número máximo de reintentos. Reinicia el bot manualmente');
        }
        break;
    default:
        console.log('[ALERTA] La conexión fue CERRADA inesperadamente, intentando reconectar...');
        await dropAuth();
        startCount++;
        setTimeout(start, 1000 * 5);
        break;
    }
}

function handleConnectionUpdate(sock) {
    return async (update) => {
        const { connection, lastDisconnect } = update;
        const reason = lastDisconnect?.error?.output?.statusCode;

        try {
            switch (connection) {
            case 'open':
                console.log('[LOG] El bot está listo para usar');
                retryCount = 0; // Reset retry count on successful connection
                await sock.sendMessage(myNumberWithJid, { text: `[INICIO] - ${startCount}` });
                break;
            case 'close':
                await handleReconnection(reason);
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
