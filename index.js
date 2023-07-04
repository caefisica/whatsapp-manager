const {
    default: makeWASocket,
    makeInMemoryStore,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    DisconnectReason,
} = require('@adiwajshing/baileys');

require('dotenv').config();
const pino = require('pino');
const { dropAuth } = require('./utils/reload');

const generalCommandPrefix = '!';
const premiumCommandPrefix = '#';
const ownerCommandPrefix = '@';
const botEmoji = '🤖';
const completeEmoji = '✅';

const commands = require('./commands');

const myNumber = process.env.OWNER_ID;
const myNumberWithJid = myNumber + "@s.whatsapp.net";
const premiumUsers = [`${myNumber}@s.whatsapp.net`];
const adminUsers = [`${myNumber}@s.whatsapp.net`];

// Statistics
let startCount = 1;

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
        }
    });

    sock.ev.on('connection.update', async (update) => {
        try {
            const { connection, lastDisconnect } = update;
        
            if(connection === 'open') {
                console.log('[LOG] El bot se ha iniciado correctamente');
                await sock.sendMessage(myNumberWithJid, {
                    text: `[INICIO] - ${startCount}`,
                });
            } else if(connection === 'close') {
                const shouldReconnect = lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
                
                if(shouldReconnect) {
                    console.log("[ALERTA] La conexión fuera CERRADA por", lastDisconnect.error, ". Reconectando en 15 segundos...");
                    setTimeout(() => {
                        start();
                    }, 1000 * 15);
                } else {
                    console.log("[PROBLEMA]: Estás fuera de línea. Prepárate para escanear el código QR de nuevo");
                    await dropAuth();
                    setTimeout(() => {
                        start();
                    }, 1000 * 5);
                }
            }
    
            console.log("[LOG] Actualización de conexión:", update);
        } catch (err) {
            await console.log(false, "connection.update", err, update);
        }
    });

    const store = makeInMemoryStore({});
    try {
        await store.readFromFile('./baileys_store.json');
    } catch (error) {
        console.error('Error al leer el archivo:', error);
    }

    setInterval(() => {
        try {
            store.writeToFile('./baileys_store.json');
        } catch (error) {
            console.error('Error al escribir en el archivo:', error);
        }
    }, 10_000);

    store.bind(sock.ev);

    sock.ev.on('chats.set', () => {
        console.log('Obtuvimos los chats:', store.chats.all());
    });

    sock.ev.on('contacts.set', () => {
        console.log('Obtuvimos los contactos:', Object.values(store.contacts));
    });

}

start().catch(console.error);
