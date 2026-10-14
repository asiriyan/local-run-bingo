// month.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { escapeHtml } = require('../utils');

router.get('/', (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM gamestatus ORDER BY timestat DESC").all();

        const tabledata = [];
        let i = 0;

        if (rows.length > 0) {
            for (const row of rows) {
                tabledata.push({
                    No: i,
                    game: escapeHtml(row.game),
                    earn: escapeHtml(row.earn)
                });
                i++;
            }
        } else {
            tabledata.push({ earn: 'empty' });
        }

        // Note: the original PHP echoes the array directly with no
        // { success, data } wrapper on the happy path — preserved as-is.
        res.json(tabledata);
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
