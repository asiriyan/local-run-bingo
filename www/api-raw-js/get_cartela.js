// get_cartela.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');

// NOTE: the original PHP called mysqli-style methods (bind_param, get_result,
// $stmt->close()) on what config.php sets up as a PDO connection — that
// combination would throw a fatal error if this endpoint were actually hit.
// Rewritten below using plain better-sqlite3 calls.
//
// NOTE: session auth requires the `express-session` middleware to be mounted
// in server.js (already included below) and something elsewhere in your app
// to set req.session.username at login time.
router.post('/', (req, res) => {
    if (!req.session || !req.session.username) {
        return res.status(401).json({ success: false, error: 'Not logged in' });
    }

    const playerNumber = parseInt(req.body.number, 10) || 0;
    if (playerNumber <= 0) {
        return res.json({ success: false, error: 'Invalid player number' });
    }

    try {
        const row = db.prepare(
            "SELECT numbers, status, win_status FROM cartelas WHERE number = ?"
        ).get(playerNumber);

        if (row) {
            res.json({
                success: true,
                data: {
                    number: playerNumber,
                    numbers: JSON.parse(row.numbers),
                    status: row.status,
                    win_status: row.win_status
                }
            });
        } else {
            res.json({ success: false, error: 'Cartela not found' });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
