// fetch_back.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD } = require('../utils');

router.get('/', (req, res) => {
    try {
        const today = todayYMD();
        const rows = db.prepare(
            "SELECT * FROM tablestat WHERE date = ? ORDER BY realtime DESC"
        ).all(today);

        const data = rows.map(row => ({
            stake: row.stake,
            game: row.game,
            calls: row.calls,
            status: row.status,
            winner: row.winner,
            bonus: row.bonus,
            free: row.free,
            player: row.player
        }));

        res.json({
            success: true,
            data: data.length ? data : null
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
