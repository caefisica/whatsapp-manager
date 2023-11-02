const { getLibraryAttendanceStatus } = require('../../db');

async function getLibraryStatus() {
  try {
      const statusMessage = await getLibraryAttendanceStatus();
      return statusMessage;
  } catch (error) {
      console.error("Error getting library status:", error);
      return "Error obtaining the status of the library.";
  }
}

module.exports = {
    getLibraryStatus
};
