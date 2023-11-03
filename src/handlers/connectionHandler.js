const {
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const { start } = require('../app');
const { myNumberWithJid, MAX_RETRIES } = require('../config/constants');
const { dropAuth } = require('../utils/reload');

// Estadísticas
let startCount = 1; // Iniciar el contador de reintentos
let retryCount = 0; // Contador de reintentos

const RECONNECTION_DELAY_BASE = 1000; // Delay base para la reconexión en milisegundos
const RECONNECTION_DELAY_MULTIPLIER = 2; // Incrementar el retraso de reconexión por este factor

async function handleReconnection(reason) {
    const tryReconnect = (delay) => {
        setTimeout(start, delay);
        startCount++;
    };

    const resetAuthAndReconnect = async () => {
        await dropAuth();
        tryReconnect(RECONNECTION_DELAY_BASE * 5);
    };

    const logAndReconnect = (message, delay) => {
        console.log(message);
        tryReconnect(delay);
    };

    switch (reason) {
    case DisconnectReason.badSession:
        console.log('[PROBLEMA] Archivo de sesión corrupto, por favor elimine la sesión y escanee de nuevo.');
        await resetAuthAndReconnect();
        break;
    case DisconnectReason.loggedOut:
    case DisconnectReason.connectionClosed:
    case DisconnectReason.connectionLost:
    case DisconnectReason.connectionReplaced:
    case DisconnectReason.restartRequired:
    case DisconnectReason.timedOut:
        if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(RECONNECTION_DELAY_MULTIPLIER, retryCount) * RECONNECTION_DELAY_BASE;
            logAndReconnect(`[PROBLEMA] Desconectado: ${reason}. Reconectando...`, delay);
            retryCount++;
        } else {
            console.error('[PROBLEMA] Se ha superado el número máximo de reintentos. Reinicia el bot manualmente');
        }
        break;
    default:
        await resetAuthAndReconnect();
        break;
    }
}

async function notifyConnectionOpen(sock) {
    retryCount = 0; // Reset contador de reintentos cuando se conecta
    console.log('[LOG] El bot está listo para usar');
    await sock.sendMessage(myNumberWithJid, { text: `[INICIO] - ${startCount}` });
}

function handleUnknownConnectionState(update) {
    console.log('[LOG] Este evento de actualización es desconocido:', update);
}

function handleConnectionUpdate(sock) {
    const connectionHandlers = {
        'connecting': () => console.log('[LOG] Conectando a WhatsApp...'),
        'open': () => notifyConnectionOpen(sock),
        'close': (reason) => handleReconnection(reason)
    };

    return async (update) => {
        const { connection, lastDisconnect, isOnline, receivedPendingNotifications } = update;

        if (isOnline) {
            console.log('[LOG] WhatsApp está en línea');
            return;
        }

        if (receivedPendingNotifications) {
            console.log('[LOG] WhatsApp recibió notificaciones pendientes');
            return;
        }

        try {
            const handler = connectionHandlers[connection] || handleUnknownConnectionState;
            await handler(lastDisconnect?.error?.output?.statusCode);
        } catch (error) {
            console.error('Error en connection.update', error, update);
        }
    };
}

module.exports = {
    handleConnectionUpdate,
};
