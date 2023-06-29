const fs = require("fs").promises;
const { downloadMediaMessage } = require("@adiwajshing/baileys");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");

const getRandom = (ext) => {
  return `${Math.floor(Math.random() * 10000)}${ext}`;
};

const handler = async (sock, message, caption) => {
  let packName = "BOT 🤖";
  let authorName = "davibot";

  const args = caption.split(' ').slice(1); // Split caption into array
  const args1 = args[0];
  const isCrop = args1 === "c" || args1 === "crop";

  if (!message.message) return;
  const messageType = Object.keys(message.message)[0]// get what type of message it is -- text, image, video

  if (messageType === 'imageMessage' || messageType === 'videoMessage') {
    const buffer = await downloadMediaMessage(
        message,
        'buffer',
        { },
        { 
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        }
    )

    const stickerMake = new Sticker(buffer, {
      pack: packName,
      author: authorName,
      type: isCrop ? StickerTypes.CROPPED : StickerTypes.FULL,
      quality: 70,
    });

    const stickerFileName = getRandom(".webp");
    await stickerMake.toFile(stickerFileName);
    await sock.sendMessage(message.key.remoteJid, {
      sticker: await fs.readFile(stickerFileName),
    });
    await fs.unlink(stickerFileName);
  }
};

module.exports = {
  handler,
};
