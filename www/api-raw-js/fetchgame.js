// fetchgame.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD } = require('../utils');

router.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');

    try {
        const currentDate = todayYMD();
        const row = db.prepare(
            "SELECT game FROM gamestatus WHERE date(timestat) = ? ORDER BY game DESC LIMIT 1"
        ).get(currentDate);

        if (row) {
            const lastGame = parseInt(row.game, 10);
            res.json({
                success: true,
                game: lastGame + 1,
                message: 'Next game number for today'
            });
        } else {
            res.json({
                success: true,
                game: 1,
                message: 'First game of the day'
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            game: 1
        });
    }
});

module.exports = router;
