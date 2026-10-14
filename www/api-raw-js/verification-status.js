const express = require('express');
const router = express.Router();
const { db } = require('../config');

// Get verification status
router.get('/', (req, res) => {
    try {
        const row = db.prepare("SELECT is_verified, verification_code FROM system_verification LIMIT 1").get();
        
        if (!row) {
            // Create default row if not exists
            db.prepare("INSERT INTO system_verification (is_verified, verification_code) VALUES (0, '')").run();
            return res.json({ is_verified: 0, verification_code: '' });
        }
        
        res.json({
            is_verified: row.is_verified || 0,
            verification_code: row.verification_code || ''
        });
    } catch (error) {
        console.error('Verification status error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;