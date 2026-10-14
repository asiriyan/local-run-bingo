const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, config, openEncrypted } = require('../config');

const RENDER_API_URL = 'https://bingo-cloud-api.onrender.com/api/upload-db';

router.post('/', async (req, res) => {
    console.log('[sync-cloud] Starting sync process');
    let dbInstance = db;

    try {
        if (!config || !config.syncSecret) {
            console.error('[sync-cloud] Config not loaded properly');
            return res.status(500).json({ success: false, message: 'Server configuration error' });
        }

        console.log('[sync-cloud] Config loaded, syncSecret:', config.syncSecret.substring(0, 10) + '...');

        if (!dbInstance) {
            if (fs.existsSync(config.dbPath)) {
                console.log('[sync-cloud] Opening database at:', config.dbPath);
                dbInstance = openEncrypted(config.dbPath, config.dbKey);
            } else {
                console.error('[sync-cloud] Database file not found at:', config.dbPath);
                return res.status(404).json({ success: false, message: `Database file not found at: ${config.dbPath}` });
            }
        }

        dbInstance.pragma('wal_checkpoint(TRUNCATE)');

        const row = dbInstance.prepare('SELECT agent_id FROM cloud_sync LIMIT 1').get();

        if (!row || !row.agent_id) {
            console.error('[sync-cloud] No Agent ID found in database');
            return res.status(400).json({ success: false, message: 'No Agent ID found in this database.' });
        }

        const agentId = row.agent_id;
        console.log('[sync-cloud] Agent ID:', agentId);

        if (!fs.existsSync(config.dbPath)) {
            console.error('[sync-cloud] Database file suddenly missing on disk');
            return res.status(404).json({ success: false, message: 'Database file suddenly missing on disk.' });
        }

        const dbBuffer = fs.readFileSync(config.dbPath);
        console.log('[sync-cloud] Database file read, size:', dbBuffer.length, 'bytes');

        if (dbBuffer.length === 0) {
            console.error('[sync-cloud] Database file is empty!');
            return res.status(400).json({ success: false, message: 'Database file is empty!' });
        }

        if (dbBuffer.length > 50 * 1024 * 1024) {
            console.error('[sync-cloud] Database file too large:', dbBuffer.length, 'bytes');
            return res.status(400).json({ success: false, message: 'Database file too large!' });
        }

        // Try using native FormData first (works in modern browsers)
        let cloudResponse;
        try {
            const nativeFormData = new FormData();
            nativeFormData.append('agent_id', agentId);
            nativeFormData.append('dbFile', new Blob([dbBuffer]), 'mccorlib.bin');

            console.log('[sync-cloud] Sending request with native FormData');
            console.log('[sync-cloud] Database file size:', dbBuffer.length, 'bytes');

            cloudResponse = await fetch(RENDER_API_URL, {
                method: 'POST',
                body: nativeFormData,
                headers: {
                    'x-sync-secret': config.syncSecret
                },
                signal: AbortSignal.timeout(60000) // 60 second timeout
            }).catch(err => {
                console.error('[sync-cloud] Fetch error:', err.message);
                throw new Error(`Connection failed: ${err.message}`);
            });
        } catch (nativeError) {
            console.error('[sync-cloud] Native FormData error:', nativeError.message);

            // Fallback to form-data library
            const FormData = require('form-data');
            const form = new FormData();
            form.append('agent_id', agentId);
            form.append('dbFile', dbBuffer, 'mccorlib.bin');

            console.log('[sync-cloud] Sending request with form-data library');
            console.log('[sync-cloud] Database file size:', dbBuffer.length, 'bytes');

            const formHeaders = form.getHeaders();
            console.log('[sync-cloud] Form headers keys:', Object.keys(formHeaders));

            cloudResponse = await fetch(RENDER_API_URL, {
                method: 'POST',
                body: form,
                headers: {
                    'x-sync-secret': config.syncSecret
                },
                signal: AbortSignal.timeout(60000) // 60 second timeout
            }).catch(err => {
                console.error('[sync-cloud] Fetch error:', err.message);
                throw new Error(`Connection failed: ${err.message}`);
            });
        }

        console.log('[sync-cloud] Cloud response status:', cloudResponse.status);
        const responseText = await cloudResponse.text();
        console.log('[sync-cloud] Cloud response text:', responseText.substring(0, 500));

        if (!cloudResponse.ok) {
            return res.status(cloudResponse.status).json({
                success: false,
                message: `Cloud returned error ${cloudResponse.status}: ${responseText.substring(0, 200)}`
            });
        }

        let cloudResult;
        try {
            cloudResult = JSON.parse(responseText);
        } catch {
            return res.status(502).json({ success: false, message: `Cloud returned a non-JSON response (status ${cloudResponse.status})` });
        }

        if (cloudResult.success) {
            dbInstance.prepare('UPDATE cloud_sync SET last_synced_at = CURRENT_TIMESTAMP').run();
            console.log('[sync-cloud] Sync successful');
            return res.json({ success: true, agent_id: agentId, message: 'Cloud sync successful.' });
        } else {
            console.error('[sync-cloud] Cloud rejected the upload:', cloudResult.message);
            return res.status(500).json({ success: false, message: cloudResult.message || 'Cloud server rejected the upload.' });
        }

    } catch (error) {
        console.error('[sync-cloud] Error:', error.message);
        console.error('[sync-cloud] Stack:', error.stack);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
