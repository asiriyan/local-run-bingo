require('bytenode');
const express = require('express');
const path = require('path');
const session = require('express-session');
const { db, config } = require('./api/config');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session store for persistence
const MemoryStore = require('memorystore')(session);
app.use(session({
    secret: 'unique-bingo-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 }),
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Database check
if (db) {
  try {
    const row = db.prepare("SELECT * FROM balanced LIMIT 1").get();
    console.log("Startup check:", row);
  } catch (err) {
    console.error("Startup query failed:", err.message);
  }
}

// Always-mounted routes
app.use('/api/setup', require('./api/setup'));
app.use('/api/session-check', require('./api/session-check'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: db ? 'connected' : 'disconnected' });
});

// Database-dependent routes
if (db) {
    app.use('/api/sync-cloud', require('./api/sync-cloud'));
    app.use('/api/balance', require('./api/balance'));
    app.use('/api/checkbalance', require('./api/checkbalance'));
    app.use('/api/get_cartela', require('./api/get_cartela'));
    app.use('/api/get_cartelas', require('./api/get_cartelas'));
    app.use('/api/getlastgame', require('./api/getlastgame'));
    app.use('/api/savegame', require('./api/savegame'));
    app.use('/api/update', require('./api/update'));
    app.use('/api/updatebalance', require('./api/updatebalance'));
    app.use('/api/updatebonus', require('./api/updatebonus'));
    app.use('/api/lastrow', require('./api/lastrow'));
    app.use('/api/log_bonus', require('./api/log_bonus'));
    app.use('/api/month', require('./api/month'));
    app.use('/api/login', require('./api/login'));
    app.use('/api/verification-status', require('./api/verification-status'));
    app.use('/api/hardware-info', require('./api/hardware-info'));
    app.use('/api/get-bonus-settings', require('./api/get-bonus-settings'));
    app.use('/api/verify', require('./api/verify'));
    app.use('/api/hardware-verify', require('./api/hardware-verify'));
    app.use('/api/index', require('./api/index'));
    app.use('/api/fetch_back', require('./api/fetch_back'));
    app.use('/api/fetch_content', require('./api/fetch_content'));
    app.use('/api/fetch_data', require('./api/fetch_data'));
    app.use('/api/fetchgame', require('./api/fetchgame'));
    app.use('/api/basedinput', require('./api/basedinput'));
    app.use('/api/fix-ongoing-games', require('./api/fix-ongoing-games'));
}

// API fallback
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found." });
});

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server and export it
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Server] Server running at http://127.0.0.1:${PORT}`);
  console.log(`[Server] Process ID: ${process.pid}`);
  console.log(`[Server] Working directory: ${process.cwd()}`);
  console.log(`[Server] __dirname: ${__dirname}`);
});

module.exports = server;