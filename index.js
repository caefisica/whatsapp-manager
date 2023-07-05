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

const generalCommandPrefix = '!';
const premiumCommandPrefix = '#';
const ownerCommandPrefix = '@';
const botEmoji = '🤖';
const completeEmoji = '✅';

const commands = require('./commands');

const myNumber = process.env.OWNER_ID;
const myNumberWithJid = myNumber + '@s.whatsapp.net';
const premiumUsers = [`${myNumber}@s.whatsapp.net`];
const adminUsers = [`${myNumber}@s.whatsapp.net`];

// Statistics
let startCount = 1;

// Restart behavior
let retryCount = 0;
const MAX_RETRIES = 5;

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

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = JSON.parse(JSON.stringify(m)).messages[0];

        const groupNumber = msg.key.remoteJid; // sent from this number (can be a group or person)
        const senderNumber = msg.key.participant;
        const isGroup = groupNumber.endsWith('@g.us');

        // This also ignores reactions
        if (!isGroup) {
            return;
        }

        // Sometimes sender key is missing, which causes the bot to crash
        if (!msg.message) {
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

        const type = msg.message.conversation
            ? 'textMessage'
            : msg.message.reactionMessage
                ? 'reactionMessage'
                : msg.message.imageMessage
                    ? 'imageMessage'
                    : msg.message.videoMessage
                        ? 'videoMessage'
                        : msg.message.stickerMessage
                            ? 'stickerMessage'
                            : msg.message.documentMessage
                                ? 'documentMessage'
                                : msg.message.documentWithCaptionMessage
                                    ? 'documentWithCaptionMessage'
                                    : msg.message.audioMessage
                                        ? 'audioMessage'
                                        : msg.message.ephemeralMessage
                                            ? 'ephemeralMessage'
                                            : msg.message.extendedTextMessage
                                                ? 'extendedTextMessage'
                                                : msg.message.viewOnceMessageV2
                                                    ? 'viewOnceMessageV2'
                                                    : 'other';
        //ephemeralMessage are from disappearing chat

        const acceptedType = [
            'textMessage',
            'imageMessage',
            'videoMessage',
            'stickerMessage',
            'documentWithCaptionMessage',
            'extendedTextMessage',
        ];
        if (!acceptedType.includes(type)) {
            return;
        }

        // Extract body of the message
        let textMessage =
          type === 'textMessage'
              ? msg.message.conversation
              : type === 'reactionMessage' && msg.message.reactionMessage.text
                  ? msg.message.reactionMessage.text
                  : type == 'imageMessage' && msg.message.imageMessage.caption
                      ? msg.message.imageMessage.caption
                      : type == 'videoMessage' && msg.message.videoMessage.caption
                          ? msg.message.videoMessage.caption
                          : type == 'documentWithCaptionMessage' && msg.message.documentWithCaptionMessage.message.documentMessage.caption
                              ? msg.message.documentWithCaptionMessage.message.documentMessage.caption
                              : type == 'extendedTextMessage' &&
              msg.message.extendedTextMessage.text
                                  ? msg.message.extendedTextMessage.text
                                  : '';
        textMessage = textMessage.replace(/\n|\r/g, ''); //remove all \n and \r

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
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        const isStatusCodeLogout = lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut;
        const shouldReconnect = lastDisconnect.error && !isStatusCodeLogout;

        try {
            switch (connection) {
            case 'open':
                console.log('[LOG] El bot está listo para usar');
                retryCount = 0; // Reset retry count on successful connection
                if (startCount > 0) return;
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
                        setTimeout(start, delay);
                    } else {
                        console.error('[PROBLEMA] Se ha superado el número máximo de reintentos. Reinicie el bot manualmente');
                    }
                } else {
                    console.log('[PROBLEMA] Estás desconectado. Prepárate para escanear el código QR');
                    await dropAuth();
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
    });
}

start().catch(console.error);