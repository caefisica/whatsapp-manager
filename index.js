const {
    default: makeWASocket,
    makeInMemoryStore,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    DisconnectReason // MessageType, MessageOptions, Mimetype
} = require('@adiwajshing/baileys');

const Boom = require('@hapi/boom')
const path = require('path');
const pino = require('pino');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

const { OWNER_ID } = process.env;

const commands = require('./commands');
const adminUsers = [`${OWNER_ID}@s.whatsapp.net`];
const generalCommandPrefix = '!';
const adminCommandPrefix = '@';

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);

    let silentLogs = pino({ level: "silent" }); // change to 'debug' to see what kind of stuff the lib is doing

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
      const messageContent = message.message;
  
      if (!messageContent) {
          return;
      }
  
      const command = messageContent.conversation 
                      || messageContent.imageMessage?.caption 
                      || messageContent.videoMessage?.caption 
                      || '';

      const [name, ...args] = command.split(' ');

      console.log(`Message from ${sender}: ${command} in ${message.key.remoteJid}`)

      const isGeneralCommand = name.startsWith(generalCommandPrefix);
      const isAdminCommand = name.startsWith(adminCommandPrefix) && adminUsers.includes(sender);
  
      if (!isGeneralCommand && !isAdminCommand) {
          return;
      }
  
      const cleanName = name.substring(1).toLowerCase();
      
      console.log('Command:', cleanName)
      console.log(message)

      try {
          switch (cleanName) {
              case 'translate': {
                  const text = args.join(' ');
                  const [translatedText] = await Promise.all([
                      commands.general.translateText(text, 'en')
                  ]);
                  await sock.sendMessage(sender, { text: translatedText });
                  break;
              }
              case 'weather': {
                  const location = args.join(' ');
                  const [weather] = await Promise.all([
                      commands.general.getWeather(location)
                  ]);
                  await sock.sendMessage(sender, { text: weather });
                  break;
              }
              case 'sticker': {
                await commands.general.sticker.handler(sock, message, command);
                break;
              }
              default: {
                  await sock.sendMessage(sender, {
                      text: `Lo siento, este comando no existe: ${name}`
                  });
                  break;
              }
          }
  
          const reactionMessage = {
              react: {
                  text: '✅',
                  key: message.key
              }
          };
  
          await sock.sendMessage(sender, reactionMessage);
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
