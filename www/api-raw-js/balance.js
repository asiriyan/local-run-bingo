// balance.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');

router.get('/', (req, res) => {
    try {
        const result = db.prepare("SELECT * FROM balanced LIMIT 1").get();
        res.json({
            success: true,
            data: result || null
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
