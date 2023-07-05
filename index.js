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
const NodeCache = require('node-cache');
const cache = new NodeCache();
const { dropAuth } = require('./utils/reload');
const { insertMessage } = require('./db');
const commands = require('./commands');
const retry = require('async-retry');

// Constants
const {
    generalCommandPrefix,
    premiumCommandPrefix,
    ownerCommandPrefix,
    botEmoji,
    completeEmoji,
    myNumberWithJid,
    premiumUsers,
    adminUsers,
    MAX_RETRIES
} = require('./config');

// Statistics
let startCount = 1;

// Restart behavior
let retryCount = 0;
// Retry behavior
const MESSAGE_PROCESSING_MAX_TRIES = 5;

// Accepted message types
const acceptedTypes = new Set([
    'conversation',
    'textMessage',
    'imageMessage',
    'videoMessage',
    // 'stickerMessage',
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

        const messageObject = await getMessageObject(sock, msg);

        if (!shouldProcessMessage(messageObject)) {
            return;
        }

        try {
            await retry(async () => {
                await processCommand(sock, msg, messageObject);
            }, {
                retries: MESSAGE_PROCESSING_MAX_TRIES,
                onRetry: (error) => {
                    console.error('Error processing message, retrying:', error);
                },
            });
        } catch (error) {
            console.error('Error processing message:', error);
            await logMessageToDatabase(messageObject, error);
        }
    };
}

async function getMessageObject(sock, msg) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    let senderNumber = isGroup ? (msg.key.participant || from) : from; // sender number can be individual or group

    if (senderNumber.includes(':')) { // some users have a ":", we remove it
        senderNumber = senderNumber.slice(0, senderNumber.search(':')) + senderNumber.slice(senderNumber.search('@'));
    }

    // Extract and cache group metadata
    let groupMetadata = '';
    if (isGroup) {
        groupMetadata = cache.get(from + ':groupMetadata');
        if (!groupMetadata) {
            groupMetadata = await sock.groupMetadata(from);
            cache.set(from + ':groupMetadata', groupMetadata, 60 * 60); // Cache group metadata for 1 hour
        }
    } else {
        // Ignore messages from non-group chats
        return;
    }

    if (!msg.message) {
        // Some unencrypted messages don't have a message object, ignore them
        // Maybe this is fixed after removing makeInMemoryStore
        return;
    }

    const isFromMe = msg.key.fromMe;
    const senderName = msg.pushName;
    const groupName = isGroup ? groupMetadata.subject : '';
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
        console.log('Message type not accepted', type);
        return;
    }

    if ((type === 'imageMessage' && !msg.message[type]?.caption) || (type === 'videoMessage' && !msg.message[type]?.caption)) {
        console.log('Ignoring messages/videos without caption');
        return;
    }

    let textMessage = msg.message[type]?.caption || msg.message[type]?.text || msg.message[type] || '';
    textMessage = textMessage.replace(/\n|\r/g, ''); //remove all \n and \r

    return {
        isDocument: type === 'documentWithCaptionMessage',
        isVideo: type === 'videoMessage',
        isImage: type === 'imageMessage',
        isSticker: type === 'stickerMessage',
        messageType: type,
        groupName,
        from,
        senderName,
        senderNumber,
        isFromMe,
        isPremiumUser,
        isAdmin,
        commandPrefix,
        textMessage,
        botEmoji,
    };
}

function shouldProcessMessage(messageObject) {
    if (!messageObject) {
        // Ignore if messageObject is undefined (stickers and videos are causing some issues with textMessage)
        return false;
    }

    if (!messageObject.textMessage.startsWith(messageObject.commandPrefix)) {
        return false;
    }

    return true;
}

async function processCommand(sock, msg, messageObject) {
    const [name, ...args] = messageObject.textMessage.split(' ');
    const commandSet = await getCommandSet(messageObject);
    const commandName = name.substring(1).toLowerCase();

    if (!commandSet[commandName]) {
        throw new Error(`Unrecognized textMessage: ${commandName}`);
    }

    await Promise.all([
        commandSet[commandName].handler(sock, msg, messageObject, args),
        sendReaction(sock, msg, messageObject),
    ]);
}

function getCommandSet(messageObject) {
    if (messageObject.isAdmin) {
        return commands.owner;
    }

    if (messageObject.isPremiumUser) {
        return commands.premium;
    }

    return commands.general;
}

async function sendReaction(sock, msg, messageObject) {
    const reactionMessage = {
        react: {
            text: completeEmoji,
            key: msg.key,
        },
    };

    await sock.sendMessage(messageObject.senderNumber, reactionMessage);
}

async function logMessageToDatabase(messageObject, error) {
    const timestamp = new Date();
    await insertMessage(
        JSON.stringify(messageObject),
        messageObject.senderNumber,
        timestamp,
        error,
    ).catch(console.error);
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
                console.log('[LOG] Este evento de actualización es desconocido:', update);
                break;
            }
        } catch (error) {
            console.error('Error en connection.update', error, update);
        }
    };
}

start().catch(console.error);
