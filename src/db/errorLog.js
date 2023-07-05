const { insertLog } = require('../db');

function mapErrorLogData({messageObject, error}) {
    return {
        error_message: JSON.stringify(messageObject),
        user_phone_number: messageObject.senderNumber,
        error_timestamp: new Date(),
        additional_info: error
    };
}

async function logErrorToDatabase(messageObject, error) {
    await insertLog(
        'ErrorLogs',
        { messageObject, error },
        mapErrorLogData
    ).catch(console.error);
}

module.exports = {
    logErrorToDatabase,
};
