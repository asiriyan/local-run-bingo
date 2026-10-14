const express = require('express');
const router = express.Router();
const { db } = require('../config');
const bcrypt = require('bcrypt');

// Hardware verification endpoint
router.post('/', (req, res) => {
    try {
        const { password } = req.body;
        
        // Get verification record
        const verificationQuery = db.prepare("SELECT is_verified, verification_code FROM system_verification LIMIT 1").get();
        
        if (!verificationQuery) {
            res.json({ error: 'No verification record found' });
            return;
        }
        
        // Check if already verified
        if (verificationQuery.is_verified === 1) {
            res.json({ success: true, message: 'System already verified' });
            return;
        }
        
        // Verify password
        if (bcrypt.compareSync(password, verificationQuery.verification_code)) {
            // Check hardware match
            const hardwareQuery = db.prepare("SELECT computer_uuid, cpu_id, bios_serial FROM hardware_lock LIMIT 1").get();
            
            if (!hardwareQuery) {
                res.json({ error: 'No hardware registered in database' });
                return;
            }
            
            // Get current hardware
            const hardwareInfo = db.prepare("SELECT computer_uuid, cpu_id, bios_serial FROM hardware_lock LIMIT 1").get();
            
            if (!hardwareInfo) {
                res.json({ error: 'No hardware info found' });
                return;
            }
            
            const match = (
                hardwareQuery.computer_uuid === hardwareInfo.computer_uuid &&
                hardwareQuery.cpu_id === hardwareInfo.cpu_id &&
                hardwareQuery.bios_serial === hardwareInfo.bios_serial
            );
            
            if (match) {
                db.prepare("UPDATE system_verification SET is_verified = 1, verified_at = datetime('now')").run();
                res.json({ success: true, message: 'System verified successfully' });
            } else {
                res.json({ error: 'This PC does not have a license for this software' });
            }
        } else {
            res.json({ error: 'Invalid verification password' });
        }
    } catch (error) {
        res.json({ error: 'Error: ' + error.message });
    }
});

module.exports = router;