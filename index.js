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

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        const sender = message.key.remoteJid; // sent from this number (can be a group or person)
        const senderNumber = messages[0].key.participant;
        const isGroup = sender.endsWith('@g.us');

        if (!isGroup) {
            return;
        }

        const isFromMe = message.key.fromMe;
        const senderName = message.pushName;
        const groupNumber = message.key.remoteJid;
        const isPremiumUser = premiumUsers.includes(sender);
        const isAdmin = adminUsers.includes(sender);
    
        let commandPrefix;
        if (isAdmin) {
            commandPrefix = ownerCommandPrefix; 
        } else if (isPremiumUser) {
            commandPrefix = premiumCommandPrefix;
        } else {
            commandPrefix = generalCommandPrefix;
        }

        let textMessage = '';
        let messageType = '';
        if(message.message) {
            if(message.message.conversation) {
                textMessage = message.message.conversation;
                messageType = 'text';
            } else if(message.message.extendedTextMessage) {
                textMessage = message.message.extendedTextMessage.text;
                messageType = 'text';
            } else if(message.message.imageMessage) {
                textMessage = message.message.imageMessage.caption;
                messageType = 'image';
            } else if(message.message.videoMessage) {
                textMessage = message.message.videoMessage.caption;
                messageType = 'video';
            } else if(message.message.audioMessage) {
                textMessage = 'audio message';
                messageType = 'audio';
            } else if(message.message.stickerMessage) {
                textMessage = 'sticker message';
                messageType = 'sticker';
            }
        }

        if (!textMessage.startsWith(commandPrefix)) {
            return;
        }

        const isDocument = messageType === 'document';
        const isVideo = messageType === 'video';
        const isImage = messageType === 'image';
        const isSticker = messageType === 'sticker';
        const hasQuotedMessage = 'quotedMessage' in message.message;

        // Create the messageObject to pass to the command handler
        const messageObject = {
            isDocument,
            isVideo,
            isImage,
            isSticker,
            hasQuotedMessage,
            messageType,
            sender,
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
                console.log(`Processed command: ${commandName} from ${senderName} (${senderNumber})`);
                await commandSet[commandName].handler(sock, message, messageObject, args);

                // React to the message after the command has been processed
                const reactionMessage = {
                    react: {
                        text: completeEmoji,
                        key: message.key
                    }
                };
                await sock.sendMessage(sender, reactionMessage);
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
