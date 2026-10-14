// getlastgame.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD } = require('../utils');

router.get('/', (req, res) => {
    try {
        const today = todayYMD();
        const row = db.prepare(
            "SELECT game FROM gamestatus WHERE date(timestat) = ? ORDER BY id DESC LIMIT 1"
        ).get(today);

        if (row) {
            const gameNumber = row.game !== undefined && row.game !== null ? parseInt(row.game, 10) : 0;
            res.json({
                success: true,
                game: gameNumber,
                today,
                hasData: true
            });
        } else {
            res.json({
                success: true,
                game: 0,
                today,
                hasData: false,
                message: 'No games for today'
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            game: 0,
            hasData: false
        });
    }
});

module.exports = router;
