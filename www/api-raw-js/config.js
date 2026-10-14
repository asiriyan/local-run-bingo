// config.js - Database connection
const path = require('path');
const Database = require('better-sqlite3');

const appData = process.env.LOCALAPPDATA;
const targetDir = path.join(appData, 'Programs', 'Common', 'cache');
const finalDbPath = path.join(targetDir, 'mccorlib.bin');

let db;
try {
    db = new Database(finalDbPath);
    db.pragma('journal_mode = WAL'); // safer for concurrent reads/writes than the PHP default
} catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
}

module.exports = { db };
