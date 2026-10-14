// fix-ongoing-games.js
// Endpoint to fix games with incorrect 'Ongoing' status (capital O)
// This ensures all games are marked as either 'ongoing' (lowercase) or 'finished' (lowercase)
const express = require('express');
const router = express.Router();
const { db } = require('../config');
const { todayYMD } = require('../utils');

router.get('/', (req, res) => {
    try {
        // Check for games with status that has different capitalization
        // We look for: 'Ongoing' (capital O), 'ONGOING' (all caps), or other variations
        const rows = db.prepare(`
            SELECT random, status, game, calls, date
            FROM tablestat
            WHERE status LIKE '%Ongoing%' OR status LIKE '%ONGOING%' OR status = 'ongoing'
        `).all();

        let fixedCount = 0;

        if (rows.length > 0) {
            console.log(`Found ${rows.length} games with potential status issues...`);
            
            // Fix each row
            const updateStmt = db.prepare(`
                UPDATE tablestat
                SET status = ?
                WHERE random = ?
            `);

            rows.forEach(row => {
                // Normalize status to lowercase
                let newStatus = row.status.toLowerCase();
                
                // If game had 75+ calls, mark as 'finished', otherwise 'ongoing'
                if (row.calls >= 75) {
                    newStatus = 'finished';
                }
                
                updateStmt.run(newStatus, row.random);
                fixedCount++;
                console.log(`  Fixed game ${row.game} (random: ${row.random}): ${row.status} → ${newStatus} (${row.calls} calls)`);
            });
        } else {
            console.log('✅ No games with status issues found.');
        }

        res.json({
            success: true,
            fixedCount: fixedCount,
            totalChecked: rows.length
        });
    } catch (error) {
        console.error('❌ Error fixing ongoing games:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
