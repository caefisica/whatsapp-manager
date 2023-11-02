const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: {
    persistSession: false
  }
});

async function insertLog(tableName, logData, mapLogData) {
    const mappedData = mapLogData(logData);
    const { data, error } = await supabase
        .from(tableName)
        .insert([mappedData]);

    if (error) throw error;
    return data;
}

async function uploadImageToSupabase(userId, buffer) {
  if(!userId) userId = 'bot';
  const fileName = `${userId}/${uuidv4()}.jpg`;
  const bucketName = 'collaborators'; 

  console.log('File name:', fileName)
  console.log('Bucket name:', bucketName)

  // Upload the image using Supabase SDK's standard upload method
  const { data, error } = await supabase.storage.from(bucketName).upload(fileName, buffer, {
    contentType: 'image/jpeg',
    upsert: false
  });

  if (error) {
    console.log('Upload error:', error);
    throw new Error('Failed to upload image to Supabase');
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
  console.log('Image URL:', url);
  return url;
}

module.exports = {
    insertLog,
    uploadImageToSupabase,
};
