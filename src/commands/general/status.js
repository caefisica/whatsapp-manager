const { getLibraryAttendanceStatus } = require("../../db");

async function getLibraryStatus() {
    try {
        const statusMessage = await getLibraryAttendanceStatus();
        return statusMessage;
    } catch (error) {
        console.error("Error al obtener el estado de la biblioteca:", error);
        return "Error al obtener el estado de la biblioteca";
    }
}

module.exports = {
    getLibraryStatus,
};
