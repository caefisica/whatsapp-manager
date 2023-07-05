const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    DisconnectReason,
} = require('@adiwajshing/baileys');

require('dotenv').config();
const pino = require('pino');
const { dropAuth } = require('./utils/reload');
const { insertMessage } = require('./db');
const commands = require('./commands');

// Constants
const generalCommandPrefix = '!';
const premiumCommandPrefix = '#';
const ownerCommandPrefix = '@';
const botEmoji = '🤖';
const completeEmoji = '✅';
const myNumber = process.env.OWNER_ID;
const myNumberWithJid = myNumber + '@s.whatsapp.net';
const premiumUsers = [`${myNumber}@s.whatsapp.net`];
const adminUsers = [`${myNumber}@s.whatsapp.net`];
const MAX_RETRIES = 5;

// Statistics
let startCount = 1;

// Restart behavior
let retryCount = 0;

// Accepted message types
const acceptedTypes = new Set([
    'textMessage',
    'imageMessage',
    'videoMessage',
    'stickerMessage',
    'documentWithCaptionMessage',
    'extendedTextMessage',
]);

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

    startCount++;
}

function handleMessageUpsert(sock) {
    return async (m) => {
        const msg = JSON.parse(JSON.stringify(m)).messages[0];

        const groupNumber = msg.key.remoteJid;
        const senderNumber = msg.key.participant;
        const isGroup = groupNumber.endsWith('@g.us');

        if (!isGroup || !msg.message) {
            return;
        }

        const isFromMe = msg.key.fromMe;
        const senderName = msg.pushName;
        const isPremiumUser = premiumUsers.includes(senderNumber);
        const isAdmin = adminUsers.includes(senderNumber);

        let commandPrefix;
        if (isAdmin) {
            commandPrefix = ownerCommandPrefix; 
        } else if (isPremiumUser) {
            commandPrefix = premiumCommandPrefix;
        } else {
            commandPrefix = generalCommandPrefix;
        }

        const type = Object.keys(msg.message)[0];
        if (!acceptedTypes.has(type)) {
            return;
        }

        let textMessage = msg.message[type]?.caption || msg.message[type]?.text || '';
        textMessage = textMessage.replace(/\n|\r/g, ''); //remove all \n and \r

        // Debugging info
        console.log('type:', type);
        console.log('textMessage:', textMessage, ', senderNumber:', senderNumber, ', senderName:', senderName, 'group', groupNumber);
        console.log('msg:', msg)

        if (!textMessage.startsWith(commandPrefix)) {
            return;
        }

        const messageObject = {
            isDocument: type === 'documentWithCaptionMessage',
            isVideo: type === 'videoMessage',
            isImage: type === 'imageMessage',
            isSticker: type === 'stickerMessage',
            messageType: type,
            groupNumber,
            senderName,
            senderNumber,
            isFromMe,
            isPremiumUser,
            isAdmin,
            commandPrefix,
            textMessage,
            botEmoji,
        };

        const [name, ...args] = textMessage.split(' ');

        try {
            const commandSet = isAdmin ? commands.owner : isPremiumUser ? commands.premium : commands.general;
            const commandName = name.substring(1).toLowerCase();

            if (commandSet[commandName]) {
                await commandSet[commandName].handler(sock, msg, messageObject, args);

                // React to the message after the command has been processed
                const reactionMessage = {
                    react: {
                        text: completeEmoji,
                        key: msg.key
                    }
                };
                await sock.sendMessage(senderNumber, reactionMessage);
            } else {
                throw new Error(`Unrecognized textMessage: ${commandName}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);

            // Send error message to database
            const timestamp = new Date();
            await insertMessage(
                JSON.stringify(messageObject),
                senderNumber,
                timestamp
            );
        }
    };
}

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
                console.error('[LOG] Este evento de actualización es desconocido:', update);
                break;
            }
        } catch (error) {
            console.error('Error en connection.update', error, update);
        }
    };
}

start().catch(console.error);
