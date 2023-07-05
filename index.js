const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
} = require('@adiwajshing/baileys');

require('dotenv').config();
const pino = require('pino');
const { handleMessageUpsert } = require('./handlers/messageHandler');
const { handleConnectionUpdate } = require('./handlers/connectionHandler');

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando WA v${version.join('.')}. ¿Es la última versión? ${isLatest}`);

    let silentLogs = pino({ level: 'silent' }); // change to 'debug' to see what kind of stuff the lib is doing

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, silentLogs),
        },
        printQRInTerminal: true,
        version,
        logger: silentLogs,
        generateHighQualityLinkPreview: true,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
    });

    sock.ev.on('creds.update', async () => {
        try {
            await saveCreds();
        } catch (error) {
            console.error('Error saving credentials:', error);
        }
    });

    sock.ev.on('messages.upsert', handleMessageUpsert(sock));

    sock.ev.on('connection.update', handleConnectionUpdate(sock));
}

start().catch(console.error);

module.exports = {
    start,
};