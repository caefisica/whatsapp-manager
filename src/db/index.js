const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

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

  // Subir la imagen usando el SDK de Supabase
  const { data, error } = await supabase.storage.from(bucketName).upload(fileName, buffer, {
    contentType: 'image/jpeg',
    upsert: false
  });

  if (error) {
    console.log('Error de subida:', error);
    throw new Error('Error al subir la imagen a Supabase');
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
  console.log('URL de la imagen:', url);
  return url;
}

module.exports = {
    insertLog,
    uploadImageToSupabase,
};
