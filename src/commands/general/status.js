const { getLibraryAttendanceStatus } = require('../../db');

async function getLibraryStatus() {
    try {
        const { openActions, closeActions } = await getLibraryAttendanceStatus();

        if (openActions.length === 0) {
            return `La biblioteca está cerrada.`;
        }

        /*
        Lógica para determinar si la biblioteca está abierta:
        1. Si no hay acciones de cierre, la biblioteca está abierta.
        2. Si hay acciones de cierre, la biblioteca está abierta si la última acción de apertura es más reciente que la última acción de cierre.

        Nota: la columan del 'timestamp' es igual al del 'created_at' (generado por Supabase)
        Puede que sea necesario refactorizar esto en el futuro ya que es repetitivo.
        */
        if (!closeActions[0] || openActions[0].timestamp > closeActions[0].timestamp) {
            // Encontrar todos los colaboradores que han abierto la biblioteca sin una acción de cierre posterior
            const currentlyOpenManagers = openActions.filter(action => 
                !closeActions[0] || action.timestamp > closeActions[0].timestamp
            ).map(action => action.managerNumber);

            let responseText = 'La biblioteca está abierta. ';
            if (currentlyOpenManagers.length === 1) {
                responseText += `Abierto por: ${currentlyOpenManagers[0]}.`;
            } else {
                responseText += 'Abierto el 216 por: ';
                responseText += currentlyOpenManagers.join(', ');
            }

            return responseText;
        } else {
            return `La biblioteca está cerrada.`;
        }

    } catch (error) {
        console.error(error);
        return `Houston, tenemos un problema: ${error.message}`;
    }
}

module.exports = {
    getLibraryStatus
};
