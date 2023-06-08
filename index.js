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
                case 'reply':
                  await sock.sendMessage(sender, { text: 'oh hello there' }, { quoted: message });
                  break;
                case 'mention':
                  await sock.sendMessage(sender, { text: '@51948394155', mentions: ['51948394155@s.whatsapp.net'] }, { quoted: message });
                  break;
                case 'location':
                  const reactionMessage = {
                      react: {
                          text: "💖", // use an empty string to remove the reaction
                          key: message.key
                      }
                  }

                  await sock.sendMessage(sender, { location: { degreesLatitude: -12.060161363038157, degreesLongitude: -77.08165388037558 } }, reactionMessage);
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
                case 'buttons':
                  /* Not working yet */
                  const buttons = [
                    {buttonId: 'id1', buttonText: {displayText: 'Button 1'}, type: 1},
                    {buttonId: 'id2', buttonText: {displayText: 'Button 2'}, type: 1},
                    {buttonId: 'id3', buttonText: {displayText: 'Button 3'}, type: 1}
                  ]
                  
                  const buttonMessage = {
                      text: "Hi it's button message",
                      footer: 'Hello World',
                      buttons: buttons,
                      headerType: 1
                  }
                  
                  const sendMsg = await sock.sendMessage(sender, buttonMessage)
                  break;
                case 'template':
                  const templateButtons = [
                    {index: 1, urlButton: {displayText: '⭐ Star Baileys on GitHub!', url: 'https://github.com/adiwajshing/Baileys'}},
                    {index: 2, callButton: {displayText: 'Call me!', phoneNumber: '+1 (234) 5678-901'}},
                    {index: 3, quickReplyButton: {displayText: 'This is a reply, just like normal buttons!', id: 'id-like-buttons-message'}},
                  ]
                  
                  const templateMessage = {
                      text: "Hi it's a template message",
                      footer: 'Hello World',
                      templateButtons: templateButtons
                  }
                  
                  const templateMsg = await sock.sendMessage(sender, templateMessage)
                  break;
                case 'lists':
                  /* Not working yet */
                  const sections = [
                    {
                    title: "Section 1",
                    rows: [
                        {title: "Option 1", rowId: "option1"},
                        {title: "Option 2", rowId: "option2", description: "This is a description"}
                    ]
                    },
                   {
                    title: "Section 2",
                    rows: [
                        {title: "Option 3", rowId: "option3"},
                        {title: "Option 4", rowId: "option4", description: "This is a description V2"}
                    ]
                    },
                  ]
                  
                  const listMessage = {
                    text: "This is a list",
                    footer: "nice footer, link: https://google.com",
                    title: "Amazing boldfaced list title",
                    buttonText: "Required, text on the button to view the list",
                    sections
                  }
                  
                  const sendLists = await sock.sendMessage(sender, listMessage);
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
                case 'buttonwith':
                  /* Not working yet */
                  const buttonsWithimage = [
                    {buttonId: 'id1', buttonText: {displayText: 'Button 1'}, type: 1},
                    {buttonId: 'id2', buttonText: {displayText: 'Button 2'}, type: 1},
                    {buttonId: 'id3', buttonText: {displayText: 'Button 3'}, type: 1}
                  ]
                  
                  const buttonMessageWithimage = {
                      image: {url: 'https://i.imgur.com/PwEwUhA.jpeg'},
                      caption: "Hi it's button message",
                      footer: 'aaaaaa',
                      buttons: buttonsWithimage,
                      headerType: 4
                  }

                  const buttonMessageWithImagen = await sock.sendMessage(sender, buttonMessageWithimage)
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
