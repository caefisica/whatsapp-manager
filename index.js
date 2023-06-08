const {
  default: makeWASocket,
  makeInMemoryStore,
  useMultiFileAuthState,
  MessageType, MessageOptions, Mimetype
} = require('@adiwajshing/baileys');

const path = require('path');
const pino = require('pino');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { OWNER_ID } = process.env;

const commands = require('./commands');
const adminUsers = [`${OWNER_ID}@s.whatsapp.net`];
const generalCommandPrefix = '!';
const adminCommandPrefix = '@';

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'debug' }),
      generateHighQualityLinkPreview: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (message.message && message.message.conversation) {
        const command = message.message.conversation;
        const sender = messages[0].key.remoteJid;

        const [name, ...args] = command.split(' ');

        const isGeneralCommand = name.startsWith(generalCommandPrefix);
        const isAdminCommand = name.startsWith(adminCommandPrefix) && adminUsers.includes(sender);
        if (!isGeneralCommand && !isAdminCommand) {
            return;
        }

        const cleanName = name.substring(1).toLowerCase();

        try {
            switch (cleanName) {
                case 'translate':
                  const text = args.join(' ');
                  console.log('Translating:', text, 'to English');
                  const translatedText = await commands.general.translateText(text, 'en');
                  await sock.sendMessage(sender, { text: translatedText });
                  break;
                case 'weather':
                  const location = args.join(' ');
                  const weather = await commands.general.getWeather(location);
                  await sock.sendMessage(sender, { text: weather });
                  break;
                case 'reply':
                  await sock.sendMessage(sender, { text: 'oh hello there' }, { quoted: message });
                  break;
                case 'mention':
                  await sock.sendMessage(sender, { text: `@${OWNER_ID}`, mentions: [`@${OWNER_ID}@s.whatsapp.net`] }, { quoted: message });
                  break;
                case 'location':
                  await sock.sendMessage(sender, { location: { degreesLatitude: -12.060161363038157, degreesLongitude: -77.08165388037558 } });
                  break;
                case 'contact':
                  const vcard = 'BEGIN:VCARD\n'
                              + 'VERSION:3.0\n' 
                              + 'FN:La Jenn\n'
                              + 'ORG:Universidad San Marcos;\n' 
                              + 'TEL;type=CELL;type=VOICE;waid=5212282289371:+52 1 228 228 9371\n'
                              + 'END:VCARD'
                  const sentMsg  = await sock.sendMessage(
                      sender,
                      { 
                          contacts: { 
                              displayName: 'David', 
                              contacts: [{ vcard }] 
                          }
                      }
                  )
                  break;
                case 'template':
                  const templateButtons = [
                    {index: 1, urlButton: {displayText: '⭐ Perimeter Institute', url: 'https://perimeterinstitute.ca/'}},
                    {index: 2, callButton: {displayText: 'Llámame!', phoneNumber: '+51 948394155'}},
                    {index: 3, quickReplyButton: {displayText: 'Contesta un mensaje aaa!', id: 'id-like-buttons-message'}},
                  ]
                  
                  const templateMessage = {
                      text: "Plantilla",
                      footer: 'Holalala',
                      templateButtons: templateButtons
                  }
                  
                  const templateMsg = await sock.sendMessage(sender, templateMessage)
                  break;
                case 'links':
                  const sentLinkMsg  = await sock.sendMessage(sender, { text: 'Terrible lo que se viene, https://www.youtube.com/watch?v=WJMBzYraE7I' });
                  break;
                case 'mp3':
                  await sock.sendMessage(
                    sender, 
                    { audio: { url: "./Media/audio.mp3" }, mimetype: 'audio/mp4' },
                    { url: "Media/audio.mp3" },
                  )
                  break;
                default:
                  await sock.sendMessage(sender, {
                    text: `Lo siento, este comando no existe: ${name}`
                  });
            }

            const reactionMessage = {
              react: {
                  text: "✅",
                  key: message.key
              }
            }

            await sock.sendMessage(sender, reactionMessage);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    }
  });

  sock.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'close') {
          try {
              console.log('Reconectando...');
              await start();
          } catch (error) {
              console.error('Error restarting connection:', error);
          }
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
