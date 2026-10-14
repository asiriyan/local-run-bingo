// updatebalance.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');

router.post('/', (req, res) => {
    const balance = parseFloat(req.body.balance ?? 0);

    try {
        const row = db.prepare("SELECT balance FROM balanced LIMIT 1").get();

        if (row) {
            const currentBalance = parseFloat(row.balance);
            const updateBal = currentBalance - balance;
            const updateBalance = Math.round(updateBal * 100) / 100;

            db.prepare("UPDATE balanced SET balance = ?").run(updateBalance);

            res.json({ message: 'Balance updated successfully' });
        } else {
            res.json({ error: 'No data found in the table' });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;
