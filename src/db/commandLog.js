const { insertLog } = require("../db");

function mapCommandLogData({ commandId, userPhoneNumber, commandName }) {
    return {
        command_id: commandId,
        user_phone_number: userPhoneNumber,
        command_name: commandName,
        execution_timestamp: new Date(),
    };
}

async function logCommandToDatabase(commandId, userPhoneNumber, commandName) {
    await insertLog(
        "CommandsUsage",
        { commandId, userPhoneNumber, commandName },
        mapCommandLogData
    ).catch(console.error);
}

module.exports = {
    logCommandToDatabase,
};
