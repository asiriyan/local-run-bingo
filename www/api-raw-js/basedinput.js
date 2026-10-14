// basedinput.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { escapeHtml, formatWeekday } = require('../utils');

router.post('/', (req, res) => {
    const number = Number(req.body.inputvalue);
    const fnumber = Number(req.body.finalvalue);

    try {
        const initial = number - 1;
        const final = fnumber - initial;

        const rows = db.prepare(
            "SELECT * FROM gamestatus ORDER BY timestat DESC LIMIT ? OFFSET ?"
        ).all(final, initial);

        const tabledata = [];
        let resultearn = 0, resultgames = 0, resultnet = 0, resultbal = 0;

        if (rows.length > 0) {
            let i = number;
            for (const row of rows) {
                resultearn += row.earn || 0;
                resultgames += row.game || 0;
                resultnet += row.net || 0;
                resultbal += row.fillbal || 0;

                const formatdate = formatWeekday(row.timestat);
                tabledata.push({
                    No: i,
                    game: escapeHtml(row.game),
                    earn: escapeHtml(row.earn),
                    net: escapeHtml(row.net),
                    balance: escapeHtml(row.fillbal),
                    time: escapeHtml(`${row.timestat}, ${formatdate}`)
                });
                i++;
            }
        } else {
            tabledata.push({ earn: 'empty' });
        }

        const total = { resultearn, resultgames, resultnet, resultbal, number };

        res.json({
            success: true,
            data: { table: tabledata, total }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
