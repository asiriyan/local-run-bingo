// lastrow.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD } = require('../utils');

router.get('/', (req, res) => {
    try {
        const today = todayYMD();
        const lastRow = db.prepare(
            "SELECT * FROM gamestatus WHERE timestat = ?"
        ).get(today);

        res.json({
            success: true,
            data: lastRow || null
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
