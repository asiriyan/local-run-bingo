const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { db } = require('../config');

// Login handler
router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.json({ success: false, error: 'Email and password are required' });
        }
        
        // Get user from database
        const user = db.prepare("SELECT * FROM user_info WHERE username = ? LIMIT 1").get(email);
        
        if (!user) {
            return res.json({ success: false, error: 'Invalid user account' });
        }
        
        // Verify password
        const match = await bcrypt.compare(password, user.password);
        
        if (!match) {
            return res.json({ success: false, error: 'Invalid password' });
        }
        
        // Set session - don't overwrite req.session, just add properties
        req.session.username = user.username;
        req.session.hardware_verified = true;
        
        res.json({
            success: true,
            message: 'Login successful',
            username: user.username
        });
    } catch (error) {
        console.error('Login error:', error);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
