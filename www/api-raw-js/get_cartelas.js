// get_cartelas.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');

router.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');

    try {
        const rows = db.prepare(
            "SELECT car_number, cartela_data FROM cartelas ORDER BY car_number"
        ).all();

        const response = rows.map(row => {
            let cartelaData;
            try {
                cartelaData = JSON.parse(row.cartela_data);
            } catch (e) {
                // If JSON is invalid, use raw data — mirrors the PHP fallback
                cartelaData = row.cartela_data;
            }
            return { [`car${row.car_number}`]: cartelaData };
        });

        // JSON_PRETTY_PRINT equivalent
        res.type('json').send(JSON.stringify(response, null, 4));
    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;
