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

async function getLibraryAttendanceStatus() {
  try {
      /* Obtener los registros de asistencia de los últimos 5 (limit) colaboradores que abrieron la biblioteca */
      const { data: openActions, error: openError } = await supabase
          .from('libraryAttendance')
          .select('managerNumber, timestamp')
          .eq('action', 'open')
          .order('timestamp', { ascending: false })
          .limit(5);

      const { data: closeActions, error: closeError } = await supabase
          .from('libraryAttendance')
          .select('timestamp')
          .eq('action', 'close')
          .order('timestamp', { ascending: false })
          .limit(1);

      if (openError) throw openError;
      if (closeError) throw closeError;

      return {
          openActions: openActions,
          closeActions: closeActions
      };

  } catch (error) {
      console.error('Error en getLibraryAttendanceStatus:', error);
      throw error;
  }
}

module.exports = {
    insertLog,
    uploadImageToSupabase,
    getLibraryAttendanceStatus
};
