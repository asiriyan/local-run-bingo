// update.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD, toYMD } = require('../utils');

router.post('/', (req, res) => {
    const data = req.body;

    try {
        if (!data || Object.keys(data).length === 0) {
            throw new Error('No data received');
        }

        const earn = parseFloat(data.earn ?? 0);
        const fulldate = data.fulldate ? toYMD(data.fulldate) : todayYMD();
        const stake = parseFloat(data.cash ?? 0);
        const balance = parseFloat(data.balance ?? 0);
        const game = parseInt(data.game ?? 0, 10);

        const balRow = db.prepare("SELECT balance FROM balanced LIMIT 1").get();
        const reBal = balRow ? parseFloat(balRow.balance) : 0;

        const row = db.prepare("SELECT * FROM gamestatus WHERE timestat = ? LIMIT 1").get(fulldate);

        let gameNumber;
        if (row) {
            const updatedEarn = parseFloat(row.earn) + earn;
            const updatedNet = parseFloat(row.net) + earn;
            const updatedGame = game > 0 ? game : parseInt(row.game, 10) + 1;
            const updatedRemain = reBal - balance;

            // fillbal should NOT be calculated from current balance - it's only updated by verify.js
            db.prepare(
                `UPDATE gamestatus SET
                    earn = ?, net = ?, game = ?, stake = ?, remain = ?
                 WHERE timestat = ?`
            ).run(updatedEarn, updatedNet, updatedGame, stake, updatedRemain, fulldate);

            gameNumber = updatedGame;
        } else {
            const newgame = 1;
            const newbalance = reBal - balance;

            // fillbal should NOT be calculated from current balance - it's only updated by verify.js
            db.prepare(
                `INSERT INTO gamestatus
                    (game, earn, timestat, stake, net, remain)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).run(newgame, earn, fulldate, stake, earn, newbalance);

            gameNumber = newgame;
        }

        const newBalance = reBal - balance;
        db.prepare("UPDATE balanced SET balance = ?").run(newBalance);

        res.json({
            success: true,
            message: 'Daily summary updated',
            game_number: gameNumber
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            input_received: data ?? 'No input'
        });
    }
});

module.exports = router;
