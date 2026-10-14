const express = require('express');
const router = express.Router();
const { db } = require('../config');
const bcrypt = require('bcrypt');

// Login endpoint
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            res.json({ error: 'Email and password are required' });
            return;
        }
        
        // Check if hardware is verified
        const hardwareQuery = db.prepare("SELECT is_verified FROM system_verification LIMIT 1").get();
        
        if (!hardwareQuery || hardwareQuery.is_verified !== 1) {
            res.json({ error: 'System verification required!' });
            return;
        }
        
        // Check user credentials
        const userQuery = db.prepare("SELECT * FROM user_info WHERE username = ? LIMIT 1").get(email);
        
        if (!userQuery) {
            res.json({ error: 'Invalid user account' });
            return;
        }
        
        if (bcrypt.compareSync(password, userQuery.password)) {
            res.json({ success: true, username: userQuery.username });
        } else {
            res.json({ error: 'Invalid password' });
        }
    } catch (error) {
        res.json({ error: 'Error: ' + error.message });
    }
});

// Session check endpoint
router.get('/session-check', (req, res) => {
    try {
        const hardwareQuery = db.prepare("SELECT is_verified FROM system_verification LIMIT 1").get();
        
        if (!hardwareQuery || hardwareQuery.is_verified !== 1) {
            res.json({ verified: false });
            return;
        }
        
        res.json({ verified: true });
    } catch (error) {
        res.json({ verified: false });
    }
});

// Get verification status endpoint
router.get('/verification-status', (req, res) => {
    try {
        const hardwareQuery = db.prepare("SELECT is_verified FROM system_verification LIMIT 1").get();
        
        if (!hardwareQuery) {
            res.json({ is_verified: 0 });
            return;
        }
        
        res.json({
            is_verified: hardwareQuery.is_verified
        });
    } catch (error) {
        res.json({ is_verified: 0 });
    }
});

// Verify hardware endpoint
router.post('/verify', (req, res) => {
    try {
        const { password } = req.body;
        
        const verificationQuery = db.prepare("SELECT is_verified, verification_code FROM system_verification LIMIT 1").get();
        
        if (!verificationQuery) {
            res.json({ error: 'No verification record found' });
            return;
        }
        
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
                res.json({ success: true });
            } else {
                res.json({ error: 'License is not valid for this computer' });
            }
        } else {
            res.json({ error: 'Invalid verification password' });
        }
    } catch (error) {
        res.json({ error: 'Error: ' + error.message });
    }
});

module.exports = router;