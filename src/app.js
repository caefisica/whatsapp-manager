const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const NodeCache = require('node-cache');

const msgRetryCounterCache = new NodeCache();

const { handleMessageUpsert } = require('./handlers/messageHandler');
const { handleConnectionUpdate } = require('./handlers/connectionHandler');

const myNumberWithJid = process.env.OWNER_ID + '@s.whatsapp.net';

const app = express();
app.use(bodyParser.json());

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    let silentLogs = pino({ level: 'silent' });  // change to 'debug' to see what kind of stuff the lib is doing

    store?.readFromFile('./baileys_store_multi.json');
    setInterval(() => {
        store?.writeToFile('./baileys_store_multi.json');
    }, 10_000);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, silentLogs),
        },
        printQRInTerminal: true,
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        browser: ['Sumi', 'Safari', '1.0.0'],
        generateHighQualityLinkPreview: true,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
        msgRetryCounterCache,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg.message || undefined;
            }
            return {
                conversation: 'Hello there!'
            };
        }
    });

    store.bind(sock.ev);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', handleMessageUpsert(sock));
    sock.ev.on('connection.update', handleConnectionUpdate(sock));

    app.post('/send-message', async (req, res) => {
        try {
            console.log('Request recibido:', req.body);

            const { recipientNumber, text } = req.body;
            console.log('Enviando mensaje a', recipientNumber, ': ', text);
            await sock.sendMessage(recipientNumber || myNumberWithJid, { text });
            res.status(200).json({ status: 'sent' });
        } catch (error) {
            console.error('Error enviando el mensaje:', error);
            res.status(500).json({ status: 'error' });
        }
    });

    store?.bind(sock.ev);

    app.listen(6000, () => {
        console.log('La API del bot se está ejecutando en el puerto 6000');
    });
}

start().catch(console.error);

module.exports = {
    start,
};
