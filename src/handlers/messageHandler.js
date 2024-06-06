const NodeCache = require("node-cache");
const cache = new NodeCache();
const commands = require("../commands");
const { logErrorToDatabase } = require("../db/errorLog");
const { logCommandToDatabase } = require("../db/commandLog");
const retry = require("async-retry");

// Constants
const {
    generalCommandPrefix,
    premiumCommandPrefix,
    ownerCommandPrefix,
    botEmoji,
    completeEmoji,
    premiumUsers,
    adminUsers,
} = require("../config/constants");

// Retry behavior
const MESSAGE_PROCESSING_MAX_TRIES = 5;

// Accepted message types
const acceptedTypes = new Set([
    "conversation",
    "textMessage",
    "imageMessage",
    "videoMessage",
    // 'stickerMessage', // Stickers do not have a caption (mandatory for message object)
    "documentWithCaptionMessage",
    "extendedTextMessage",
]);

function handleMessageUpsert(sock) {
    return async m => {
        const msg = JSON.parse(JSON.stringify(m)).messages[0];

        const messageObject = await getMessageObject(sock, msg);

        if (!shouldProcessMessage(messageObject)) {
            return;
        }

        try {
            await retry(
                async () => {
                    await processCommand(sock, msg, messageObject);
                },
                {
                    retries: MESSAGE_PROCESSING_MAX_TRIES,
                    onRetry: error => {
                        console.error(
                            "Error processing message, retrying:",
                            error
                        );
                    },
                }
            );
        } catch (error) {
            console.error("Error processing message:", error);
            await logErrorToDatabase(messageObject, error);
        }
    };
}

async function getMessageObject(sock, msg) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    let senderNumber = isGroup ? msg.key.participant || from : from; // sender number can be individual or group

    if (senderNumber.includes(":")) {
        // some users have a ":", we remove it
        senderNumber =
            senderNumber.slice(0, senderNumber.search(":")) +
            senderNumber.slice(senderNumber.search("@"));
    }

    // Extract and cache group metadata
    let groupMetadata = "";
    if (isGroup) {
        groupMetadata = cache.get(from + ":groupMetadata");
        if (!groupMetadata) {
            groupMetadata = await sock.groupMetadata(from);
            cache.set(from + ":groupMetadata", groupMetadata, 60 * 60); // Cache group metadata for 1 hour
        }
    } else {
        // Ignore messages from non-group chats
        return;
    }

    if (!msg.message) {
        // Some unencrypted messages don't have a message object, ignore them
        // Maybe this is fixed after removing makeInMemoryStore
        return;
    }

    const isFromMe = msg.key.fromMe;
    const senderName = msg.pushName;
    const groupName = isGroup ? groupMetadata.subject : "";
    const isPremiumUser = premiumUsers.includes(senderNumber);
    const isAdmin = adminUsers.includes(senderNumber);

    let commandPrefix;
    if (isAdmin) {
        commandPrefix = ownerCommandPrefix;
    } else if (isPremiumUser) {
        commandPrefix = premiumCommandPrefix;
    } else {
        commandPrefix = generalCommandPrefix;
    }

    const type = Object.keys(msg.message)[0];
    if (!acceptedTypes.has(type)) {
        console.log("Message type not accepted", type);
        return;
    }

    if (
        (type === "imageMessage" && !msg.message[type]?.caption) ||
        (type === "videoMessage" && !msg.message[type]?.caption)
    ) {
        console.log("Ignoring messages/videos without caption");
        return;
    }

    let textMessage =
        msg.message[type]?.caption ||
        msg.message[type]?.text ||
        msg.message[type] ||
        "";
    textMessage = textMessage.replace(/\n|\r/g, ""); //remove all \n and \r

    return {
        isDocument: type === "documentWithCaptionMessage",
        isVideo: type === "videoMessage",
        isImage: type === "imageMessage",
        isSticker: type === "stickerMessage",
        messageType: type,
        groupName,
        from,
        senderName,
        senderNumber,
        isFromMe,
        isPremiumUser,
        isAdmin,
        commandPrefix,
        textMessage,
        botEmoji,
    };
}

function shouldProcessMessage(messageObject) {
    if (!messageObject) {
        // Ignore if messageObject is undefined (stickers and videos are causing some issues with textMessage)
        return false;
    }

    if (!messageObject.textMessage.startsWith(messageObject.commandPrefix)) {
        return false;
    }

    return true;
}

async function processCommand(sock, msg, messageObject) {
    const [name, ...args] = messageObject.textMessage.split(" ");
    const commandSet = await getCommandSet(messageObject);
    const commandName = name.substring(1).toLowerCase();

    if (!commandSet[commandName]) {
        console.error(`Unrecognized textMessage: ${commandName}`);
        await logErrorToDatabase(
            messageObject,
            new Error(`Unrecognized textMessage: ${commandName}`)
        );
        return;
    }

    await Promise.all([
        commandSet[commandName].handler(sock, msg, messageObject, args),
        logCommandToDatabase(name, messageObject.senderNumber, commandName),
        sendReaction(sock, msg, messageObject),
    ]);
}

function getCommandSet(messageObject) {
    if (messageObject.isAdmin) {
        return { ...commands.general, ...commands.premium, ...commands.owner };
    }

    if (messageObject.isPremiumUser) {
        return { ...commands.general, ...commands.premium };
    }

    return commands.general;
}

async function sendReaction(sock, msg, messageObject) {
    const reactionMessage = {
        react: {
            text: completeEmoji,
            key: msg.key,
        },
    };

    await sock.sendMessage(messageObject.senderNumber, reactionMessage);
}

module.exports = {
    handleMessageUpsert,
};
