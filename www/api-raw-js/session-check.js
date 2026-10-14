const express = require('express');
const router = express.Router();

// Make sure you still have your db import at the top of the file!
const { db } = require('../config'); 

// Session check endpoint
// CHANGED '/session-check' to '/'
router.get('/', (req, res) => {
    try {
        const hardwareQuery = db.prepare("SELECT is_verified FROM system_verification LIMIT 1").get();
        const hardware_verified = !!(hardwareQuery && hardwareQuery.is_verified === 1);
        const logged_in = !!req.session.username;

        // --- NEW: Fetch the Cloud ID (Phone Number) ---
        let cloud_id = 'No ID';
        const cloudRow = db.prepare("SELECT agent_id FROM cloud_sync LIMIT 1").get();
        
        if (cloudRow && cloudRow.agent_id) {
            cloud_id = cloudRow.agent_id;
        }

        // Log the result to the terminal so you can see it
        console.log('Cloud ID fetched from DB:', cloud_id);

        // Return everything to the frontend
        res.json({ 
            hardware_verified, 
            logged_in, 
            cloud_id 
        });
    } catch (error) {
        console.error('Session check error:', error.message); // Log errors too!
        res.json({ 
            hardware_verified: false, 
            logged_in: false, 
            cloud_id: 'Error' 
        });
    }
});

module.exports = router;