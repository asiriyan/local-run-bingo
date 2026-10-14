// log_bonus.js
// Called by bingo.js's awardBonus() every time a bonus actually fires.
const express = require('express');
const router = express.Router();
const { db } = require('../config');

// NOTE: the original PHP included config.php (which sets $con) but then
// queried against $pdo, an undefined variable — calling ->prepare() on null
// would have thrown a fatal error every time this endpoint was hit. Fixed
// here to use the actual db connection.
router.post('/', (req, res) => {
    if (!req.session || !req.session.username) {
        return res.json({ success: false, error: 'unauthorized' });
    }
    const agent = req.session.username;
    const inData = req.body || {};

    try {
        const stmt = db.prepare(
            `INSERT INTO bonus_log
                (agent_username, random_number, game_no, cartela_number, bonus_type, bonus_amount, call_count_at_trigger, triggering_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run(
            agent,
            inData.randomNumber ?? '',
            parseInt(inData.game ?? 0, 10),
            parseInt(inData.cartela ?? 0, 10),
            inData.type ?? '',
            parseFloat(inData.amount ?? 0),
            parseInt(inData.calls ?? 0, 10),
            inData.triggeringNumber !== undefined ? parseInt(inData.triggeringNumber, 10) : null
        );

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
