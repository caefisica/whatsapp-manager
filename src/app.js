const express = require('express');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');

const { handleMessageUpsert } = require('./handlers/messageHandler');
const { handleConnectionUpdate } = require('./handlers/connectionHandler');

const app = express();
app.use(express.json());

const logger = pino({ level: 'silent' });

const store = makeInMemoryStore({ logger: logger.child({ level: 'silent', stream: 'store' }) });
const msgRetryCounterCache = new NodeCache();
const myNumberWithJid = process.env.OWNER_ID + '@s.whatsapp.net';

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    store.readFromFile('./baileys_store_multi.json');
    setInterval(async () => {
        try {
            await store.writeToFile('./baileys_store_multi.json');
        } catch (error) {
            logger.error('Error escribiendo en el archivo store:', error);
        }
    }, 10_000);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true,
        version: (await fetchLatestBaileysVersion()).version,
        logger: logger,
        browser: ['Sumi', 'Safari', '3.0'],
        generateHighQualityLinkPreview: true,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
        msgRetryCounterCache,
        getMessage: async (key) => {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg?.message || { conversation: 'Hello there!' };
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', handleMessageUpsert(sock));
    sock.ev.on('connection.update', handleConnectionUpdate(sock));

    app.post('/send-message', async (req, res) => {
        try {
            logger.info('Request recibido:', req.body);
            const { recipientNumber, text } = req.body;
            logger.info('Enviando mensaje:', { recipientNumber, text });
            await sock.sendMessage(recipientNumber || myNumberWithJid, { text });
            res.status(200).json({ status: 'sent' });
        } catch (error) {
            logger.error('Error enviando el mensaje:', error);
            res.status(500).json({ status: 'error' });
        }
    });

    app.listen(6000, () => {
        logger.info('La API del bot se está ejecutando en el puerto 6000');
    }).on('error', (err) => {
        logger.error('Servidor Express tuvo un error al iniciar:', err);
    });
}

start().catch(console.error);

module.exports = {
    start,
};
