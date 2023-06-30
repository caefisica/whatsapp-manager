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
const Boom = require('@hapi/boom');  // Para el manejo de errores
const pino = require('pino');       // Para el manejo de logs

const generalCommandPrefix = '!';
const premiumCommandPrefix = '#';
const ownerCommandPrefix = '@';
const botEmoji = '🤖';

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
        console.log('New message received:', messages[0]);
        const message = messages[0];
        const sender = message.key.remoteJid;
    
        // Check whether the message is from a group first
        if (!sender.endsWith('@g.us')) {
            return;
        }
    
        const isFromMe = message.key.fromMe;
        const senderName = message.pushName;
        const groupNumber = message.key.remoteJid;

        console.log('Is from me:', isFromMe);
        console.log('Sender name:', senderName);
        console.log('Group number:', groupNumber);
    
        const isPremiumUser = premiumUsers.includes(sender); // Assuming premiumUsers is an array of user ids
        const isAdmin = adminUsers.includes(sender); // Assuming adminUsers is an array of user ids
    
        let commandPrefix;
        if (isAdmin) {
            commandPrefix = ownerCommandPrefix; 
        } else if (isPremiumUser) {
            commandPrefix = premiumCommandPrefix;
        } else {
            commandPrefix = generalCommandPrefix;
        }
    
        const textMessage = message.message.conversation 
                      || message.message.imageMessage?.caption 
                      || message.message.videoMessage?.caption 
                      || '';
    
        // Check whether the message is a command
        if (!textMessage.startsWith(commandPrefix)) {
            console.log(`Message does not start with correct prefix. Expected prefix: ${commandPrefix}, received message: ${textMessage}`);
            return;
        }
    
        const messageType = message.message.conversation 
            ? 'text' 
            : message.message.imageMessage
                ? 'image' 
                : message.message.videoMessage
                    ? 'video'
                    : null;
        console.log('Message type:', messageType);
    
        const isDocument = messageType === 'document';
        const isVideo = messageType === 'video';
        const isImage = messageType === 'image';
        const isSticker = messageType === 'sticker';
        const hasQuotedMessage = 'quotedMessage' in message.message;
    
        console.log(`Properties of the message, isDocument: ${isDocument}, isVideo: ${isVideo}, isImage: ${isImage}, isSticker: ${isSticker}, hasQuotedMessage: ${hasQuotedMessage}`);
    
        // Create the messageObject
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
            } else {
                throw new Error(`Unrecognized textMessage: ${commandName}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error instanceof Boom && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if(shouldReconnect) {
                start();
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
