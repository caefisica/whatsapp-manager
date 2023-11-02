const fs = require('fs').promises;
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
};

const handler = async (sock, message, messageObject, args) => {
    let packName = messageObject.senderName;
    let authorName = 'davibot';

    const isCrop = (args && args.length > 0) && (args[0] === 'c' || args[0] === 'crop');
    const quality = 70;

    const messageType = Object.keys(message.message)[0];// get what type of message it is -- text, image, video

    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        const buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        const stickerMake = new Sticker(buffer, {
            pack: packName,
            author: authorName,
            type: isCrop ? StickerTypes.CROPPED : StickerTypes.FULL,
            quality: quality,
        });

        const stickerFileName = getRandom('.webp');
        await stickerMake.toFile(stickerFileName);
        const sticker = await fs.readFile(stickerFileName);
        await sock.sendMessage(
            message.key.remoteJid,
            {sticker: sticker}
        );
        await fs.unlink(stickerFileName);
    }
};

module.exports = {
    handler,
};
