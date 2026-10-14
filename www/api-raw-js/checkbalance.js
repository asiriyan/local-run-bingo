// checkbalance.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');

router.get('/', (req, res) => {
    // Mirrors the original PHP header() calls; prefer the `cors` package
    // mounted globally in server.js instead of per-route if you can.
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');

    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        const row = db.prepare("SELECT balance FROM balanced LIMIT 1").get();

        if (row) {
            res.json({
                success: true,
                balance: row.balance,
                balance_numeric: parseFloat(row.balance),
                timestamp
            });
        } else {
            res.json({
                success: true,
                balance: "0.00",
                balance_numeric: 0.00,
                message: 'No balance record found',
                timestamp
            });
        }
    } catch (error) {
        res.json({
            success: false,
            balance: "0.00",
            balance_numeric: 0.00,
            error: error.message,
            timestamp
        });
    }
});

module.exports = router;
