// save_all_cartelas.js
//
// NOTE: the original PHP hardcoded all 150 cartelas inline and was meant to
// be run once, manually, from a browser URL — it always inserts, with no
// check for existing rows, so hitting it twice would duplicate all 300 rows.
// That's more dangerous as a permanently-mounted Express route than as a
// one-off PHP file, so this version adds a guard: it refuses to run if the
// cartelas table is already populated, unless you pass ?force=true.
//
// The 150-cartela grid data itself was extracted programmatically from your
// save_all_cartelas.php into data/cartelas-data.json (verified: all 150
// entries present, spot-checked against the source file) rather than
// retyped by hand, to rule out transcription errors.
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const cartelaData = require('../data/cartelas-data.json');

router.post('/', (req, res) => {
    try {
        const existingCount = db.prepare("SELECT COUNT(*) AS c FROM cartelas").get().c;
        if (existingCount > 0 && req.query.force !== 'true') {
            return res.status(409).json({
                success: false,
                error: `cartelas table already has ${existingCount} rows — pass ?force=true to insert anyway`
            });
        }

        const insert = db.prepare("INSERT INTO cartelas (car_number, cartela_data) VALUES (?, ?)");

        const insertAll = db.transaction((entries) => {
            for (const [carNumber, grid] of entries) {
                insert.run(parseInt(carNumber, 10), JSON.stringify(grid));
            }
        });

        insertAll(Object.entries(cartelaData));

        res.json({ success: true, message: 'All 150 cartelas saved to database!' });
    } catch (error) {
        // better-sqlite3 auto-rolls back the transaction on a thrown error
        res.status(500).json({ success: false, error: `Database error: ${error.message}` });
    }
});

module.exports = router;
