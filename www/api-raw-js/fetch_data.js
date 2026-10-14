// fetch_data.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { escapeHtml, formatMonthCommaDayYear } = require('../utils');

router.post('/', (req, res) => {
    const selected_date = req.body.date;

    // Original PHP only ran the query block when $_POST['date'] was set,
    // and produced no output at all otherwise. Preserved here.
    if (!selected_date) {
        return res.end();
    }

    try {
        const rows = db.prepare(
            "SELECT * FROM tablestat WHERE date = ? ORDER BY realtime DESC"
        ).all(selected_date);

        let tabledata = [];
        if (rows.length > 0) {
            tabledata = rows.map(row => ({
                game: escapeHtml(row.game),
                stake: escapeHtml(row.stake),
                player: escapeHtml(row.player),
                calls: escapeHtml(row.calls),
                winner: escapeHtml(row.winner),
                bonus: escapeHtml(row.bonus),
                free: escapeHtml(row.free),
                status: escapeHtml(row.status)
            }));
        } else {
            tabledata = [{ calls: 'No Data is found' }];
        }

        const row2 = db.prepare(
            "SELECT * FROM gamestatus WHERE timestat = ? LIMIT 1"
        ).get(selected_date);

        let gameStatusData = {};
        if (row2) {
            gameStatusData = {
                earn: row2.earn || 0,
                game: row2.game || 0,
                time: formatMonthCommaDayYear(row2.timestat) || 0,
                net: row2.net || 0,
                remain: row2.remain || 0,
                realtime: row2.timestat
            };
        }

        // Note: the original PHP response has no top-level "success" key on
        // this happy path (only on the catch branch) — preserved as-is.
        res.json({ table: tabledata, gamestatus: gameStatusData });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
