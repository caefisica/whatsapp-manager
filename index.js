const {
  default: makeWASocket,
  makeInMemoryStore,
  useMultiFileAuthState,
} = require('@adiwajshing/baileys');

const commands = require('./commands');
const adminUsers = ['51948394155@s.whatsapp.net'];
const generalCommandPrefix = '!';
const adminCommandPrefix = '@';

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true
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
                case 'ping':
                  await sock.sendMessage(sender, {
                    text: 'Pong!'
                  });
                  break;
                case 'echo':
                  await sock.sendMessage(sender, {
                    text: args.join(' ')
                  });
                  break;
                case 'translate':
                  const text = args.join(' ');
                  console.log('Translating:', text, 'to English');
                  const translatedText = await commands.general.translateText(text, 'en');
                  await sock.sendMessage(sender, { text: translatedText });
                  break;
                case 'time':
                  const currentTime = new Date();
                  await sock.sendMessage(sender, {
                    text: `La hora en el server es: ${currentTime}`
                  });
                  break;
                case 'weather':
                  const location = args.join(' ');
                  const weather = await commands.general.getWeather(location);
                  await sock.sendMessage(sender, { text: weather });
                  break;
                default:
                  await sock.sendMessage(sender, {
                    text: `Lo siento, este comando no existe: ${name}`
                  });
            }
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
