const {
    default: makeWASocket,
    makeInMemoryStore,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    DisconnectReason                  // MessageType, MessageOptions, Mimetype
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
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

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
        const sender = message.key.remoteJid;
        const senderNumber = messages[0].key.participant;
    
        // Check whether the message is from a group first
        if (!sender.endsWith('@g.us')) {
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
    
        const textMessage = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || '';

        if (!textMessage.startsWith(commandPrefix)) {
            return;
        }
    
        const messageType = message.message.conversation 
            ? 'text' 
            : message.message.imageMessage
                ? 'image' 
                : message.message.videoMessage
                    ? 'video'
                    : message.message.extendedTextMessage
                        ? 'text'
                        : null;

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
                await commandSet[commandName].handler(sock, message, messageObject, args);

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
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
    
            if(shouldReconnect) {
                console.log('Reconnecting in 5 sec to try to restore the connection...');
                setTimeout(() => {
                    start();
                }, 5000);
            } else {
                console.log('You have been logged out. Restarting in 5 sec to scan new QR code...');
                await dropAuth();
                setTimeout(() => {
                    start();
                }, 5000);
            }
    
        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });

    const store = makeInMemoryStore({});
    try {
        await store.readFromFile('./baileys_store.json');
    } catch (error) {
        console.error('Error reading from file:', error);
    }

    setInterval(() => {
        try {
            store.writeToFile('./baileys_store.json');
        } catch (error) {
            console.error('Error writing to file:', error);
        }
    }, 10_000);

    store.bind(sock.ev);

    sock.ev.on('chats.set', () => {
        console.log('got chats', store.chats.all());
    });

    sock.ev.on('contacts.set', () => {
        console.log('got contacts', Object.values(store.contacts));
    });

    sock.ev.on('connection.update', update => {
        if (update.qr) {
            console.log('Escanea este QR con tu teléfono: ' + update.qr);
        }
    });

}

start().catch(console.error);
