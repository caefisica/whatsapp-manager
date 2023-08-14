const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} = require('@adiwajshing/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');

const { handleMessageUpsert } = require('./handlers/messageHandler');
const { handleConnectionUpdate } = require('./handlers/connectionHandler');

const myNumberWithJid = process.env.OWNER_ID + '@s.whatsapp.net';

const app = express();
app.use(bodyParser.json());

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Usando WA v${version.join('.')}. ¿Es la última versión? ${isLatest}`);

  let silentLogs = pino({ level: 'silent' });  // change to 'debug' to see what kind of stuff the lib is doing

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

  sock.ev.on('creds.update', async () => {
      try {
          await saveCreds();
      } catch (error) {
          console.error('Error guardando las credenciales:', error);
      }
  });

  sock.ev.on('messages.upsert', handleMessageUpsert(sock));
  sock.ev.on('connection.update', handleConnectionUpdate(sock));

  app.post('/send-message', async (req, res) => {
      try {
          console.log("Request recibido:", req.body);

          const { recipientNumber, text } = req.body;
          console.log('Enviando mensaje a', recipientNumber, ': ', text)
          await sock.sendMessage(recipientNumber || myNumberWithJid, { text });
          res.status(200).json({ status: 'sent' });
      } catch (error) {
          console.error('Error enviando el mensaje:', error);
          res.status(500).json({ status: 'error' });
      }
  });

  app.listen(6000, () => {
      console.log('La API del bot se está ejecutando en el puerto 6000');
  });
}

start().catch(console.error);

module.exports = {
  start,
};
