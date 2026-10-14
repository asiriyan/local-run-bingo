const express = require('express');
const path = require('path');
const session = require('express-session');
const { db, config } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname))); // serve static files (CSS, JS, images)
app.use(session({
    secret: 'unique-bingo-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize database
try {
  const row = db.prepare("SELECT * FROM balanced LIMIT 1").get();
  console.log("Startup check:", row);
} catch (err) {
  console.error("Startup query failed:", err.message);
}

// API Routes
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
app.use('/api/session-check', require('./api/session-check'));
app.use('/api/verification-status', require('./api/verification-status'));
app.use('/api/hardware-info', require('./api/hardware-info'));
app.use('/api/get-bonus-settings', require('./api/get-bonus-settings'));
app.use('/api/verify', require('./api/verify'));
app.use('/api/hardware-verify', require('./api/hardware-verify'));
app.use('/api/index', require('./api/index'));
app.use('/api/save_all_cartelas', require('./api/save_all_cartelas'));
app.use('/api/fetch_back', require('./api/fetch_back'));
app.use('/api/fetch_content', require('./api/fetch_content'));
app.use('/api/fetch_data', require('./api/fetch_data'));
app.use('/api/fetchgame', require('./api/fetchgame'));
app.use('/api/basedinput', require('./api/basedinput'));
app.use('/api/check', require('./api/check'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: db ? 'connected' : 'disconnected' });
});

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback: for any non‑API route, serve index.html
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});