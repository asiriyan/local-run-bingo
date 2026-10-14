// savegame.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD } = require('../utils');

router.post('/', (req, res) => {
    const data = req.body;

    try {
        if (!data || Object.keys(data).length === 0) {
            throw new Error('No data received');
        }

        const realTimeValue = data.realtime ?? data.realTime ?? new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Validate required fields
        const required = ['randomNumber', 'game', 'cash', 'players', 'dateobj'];
        const errors = [];
        for (const field of required) {
            const val = data[field];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
                errors.push(`Missing or empty required field: ${field}`);
            }
        }
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        const random = parseInt(data.randomNumber ?? 0, 10);
        const game = parseInt(data.game ?? 0, 10);
        const stake = parseFloat(data.cash ?? 0);
        const winner = data.winwin ?? "[-]";
        const free = data.free ?? "-";
        const calls = parseInt(data.calls ?? 0, 10);
        const bonus = parseFloat(data.sumBonus ?? 0);
        const status = data.status ?? "finished";
        const player = parseInt(data.players ?? 0, 10);
        const date = data.dateobj ?? todayYMD();
        const realTime = realTimeValue;

        const exists = db.prepare("SELECT 1 FROM tablestat WHERE random = ?").get(random) !== undefined;

        if (exists) {
            db.prepare(
                `UPDATE tablestat SET
                    game = ?, stake = ?, calls = ?, free = ?,
                    winner = ?, bonus = ?, status = ?, player = ?,
                    date = ?, realtime = ?
                 WHERE random = ?`
            ).run(game, stake, calls, free, winner, bonus, status, player, date, realTime, random);
        } else {
            db.prepare(
                `INSERT INTO tablestat
                    (random, game, stake, calls, free, winner, bonus, status, player, date, realtime)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(random, game, stake, calls, free, winner, bonus, status, player, date, realTime);
        }

        res.json({
            success: true,
            action: exists ? 'updated' : 'inserted',
            random,
            game,
            message: 'Game saved successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            input_received: data ?? 'No input',
            data_received: data ?? 'No data parsed'
        });
    }
});

module.exports = router;
