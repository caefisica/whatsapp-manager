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

const { OWNER_ID } = process.env;
const premiumUsers = [`${OWNER_ID}@s.whatsapp.net`];
const adminUsers = [`${OWNER_ID}@s.whatsapp.net`];

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
        const { connection, lastDisconnect } = update;
    
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            console.log('La sesión fue cerrada debido a que', lastDisconnect.error, '. Reconectando:', shouldReconnect);
    
            if(shouldReconnect) {
                console.log('Reconectando en 5 segundos...');
                setTimeout(() => {
                    start();
                }, 5000);
            } else {
                console.log('Parece que la sesión ya no está autorizada. Eliminando credenciales y reconectando en 5 segundos...');
                await dropAuth();
                setTimeout(() => {
                    start();
                }, 5000);
            }
    
        } else if(connection === 'open') {
            console.log('Establecida conexión con WhatsApp. El bot está listo para procesar mensajes.');
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

    sock.ev.on('connection.update', update => {
        if (update.qr) {
            console.log('Escanea este QR con tu teléfono: ' + update.qr);
        }
    });

}

start().catch(console.error);
