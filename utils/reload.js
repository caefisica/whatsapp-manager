const fs = require('fs-extra');

async function dropAuth() {
    try {
        await fs.remove('auth_info_baileys');
        console.log('Session deleted successfully.');
    } catch (err) {
        console.error('Failed to delete session:', err);
    }
}

module.exports = {
    dropAuth,
};