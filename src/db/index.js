const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: {
    persistSession: false
}
});

async function insertCommandLog(user_phone_number, command_name, execution_timestamp) {
    const { data, error } = await supabase
        .from('Commands_Logs')
        .insert([
            { user_phone_number, command_name, execution_timestamp },
        ]);
  
    if (error) throw error;
    return data.content;
}

async function insertErrorLog(error_message, user_phone_number, error_timestamp) {
    const { data, error } = await supabase
        .from('ErrorLogs')
        .insert([
            { error_message, user_phone_number, error_timestamp },
        ]);
  
    if (error) throw error;
    return data;
}

async function insertMessage(error_message, user_phone_number, error_timestamp) {
    const { data, error } = await supabase
        .from('ErrorLogs')
        .insert([
            { error_message, user_phone_number, error_timestamp },
        ]);

    if (error) throw error;
    return data;
}

async function getMessages() {
    const { data, error } = await supabase
        .from('Messages')
        .select('*');
  
    if (error) throw error;
    return data;
}

module.exports = {
    insertCommandLog,
    insertErrorLog,
    insertMessage,
    getMessages,
};