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
      const { data: openActions, error: openError } = await supabase
          .from('libraryAttendance')
          .select(`
              timestamp,
              action,
              managerNumber
          `)
          .eq('action', 'open')
          .order('timestamp', { ascending: false })
          .limit(1);

      let librarianName = '';

      if (openActions && openActions.length > 0) {
          const managerNum = openActions[0].managerNumber;

          const { data: librarianData, error: librarianError } = await supabase
              .from('librarians')
              .select('fullName')
              .eq('managerNumber', managerNum)
              .single();

          if (librarianData) {
              librarianName = librarianData.fullName;
          } else {
              console.error("No se encontró ningún librarian para el número:", managerNum)
          }

          if (librarianError) {
              console.error("Error en librarians:", librarianError);
          }
      }

      const { data: closeActions, error: closeError } = await supabase
          .from('libraryAttendance')
          .select('timestamp')
          .eq('action', 'close')
          .order('timestamp', { ascending: false })
          .limit(1);

      if (openError) {
          console.error("Error en openActions:", openError);
          throw new Error("Error al obtener los openActions de Supabase.");
      }

      if (closeError) {
          console.error("Error en closeActions:", closeError)
          throw new Error("Error al obtener los closeActions de Supabase.");
      }

      if (openActions && openActions.length > 0) {
          if (!closeActions || closeActions.length === 0 || openActions[0].timestamp > closeActions[0].timestamp) {
              return `La biblioteca está abierta. Abierto por: ${librarianName}.`;
          }
      }
      return 'La biblioteca está cerrada.';

  } catch (error) {
      console.error(error);
      return `Houston, tenemos un problema: ${error.message}`;
  }
}

async function getTodayImageDescriptions() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: attendanceData, error: attendanceError } = await supabase
        .from('libraryAttendance')
        .select('imageUrl, timestamp, managerNumber')
        .eq('action', 'open')
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString());

    if (attendanceError) {
        console.error("Error en la tabla 'libraryAttendance':", attendanceError);
        throw new Error("Ha ocurrido un error al obtener los datos de la tabla 'libraryAttendance'.")
    }

    const descriptions = [];

    for (const log of attendanceData) {
        const { data: librarianData, error: librarianError } = await supabase
            .from('librarians')
            .select('fullName')
            .eq('managerNumber', log.managerNumber)
            .single();

        if (librarianError) {
            console.error("Error en la tabla 'librarians':", librarianError);
            throw new Error("Ha ocurrido un error al obtener los datos de la tabla 'librarians'.")
        }

        const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        descriptions.push({
            imageUrl: log.imageUrl,
            description: `${librarianData.fullName}: ${time}`
        });
    }

    return descriptions;
}

module.exports = {
    insertLog,
    uploadImageToSupabase,
    getLibraryAttendanceStatus,
    getTodayImageDescriptions
};
