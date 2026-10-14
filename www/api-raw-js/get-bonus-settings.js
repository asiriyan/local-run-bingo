// get_bonus_settings.js
// GET  -> returns the logged-in agent's bonus settings (creates a disabled-by-default row if missing)
// POST -> saves whichever fields are sent (used by dashboard.php toggle form / fetch call)
//
// NOTE: bingo.js calls this at /api/get-bonus-settings (hyphenated), matching
// how server.js mounts it — even though the original PHP filename used
// underscores. Keep that mount path if you rename this file.
const express = require('express');
const router = express.Router();
const { db } = require('../config');

const FIELDS = [
    'commission_rate',
    'four_call_bonus_enabled', 'four_call_bonus_amount',
    'eight_call_bonus_enabled', 'eight_call_bonus_amount',
    'edge_diagonal_bonus_enabled', 'edge_diagonal_bonus_amount',
    'row_column_bonus_enabled', 'row_column_bonus_amount',
    'free_bingo_enabled', 'free_bingo_amount', 'free_bingo_call_threshold',
    'happy_hour_enabled', 'happy_hour_min_amount', 'happy_hour_max_amount',
    'happy_hour_probability', 'happy_hour_start_time', 'happy_hour_end_time',
    // ── Pattern toggles (ON/OFF only, no bonus amount) ──
    'inner_edges_enabled',
    'inner_cross_enabled',
    'outer_cross_enabled'
];

function requireAgent(req, res) {
    if (!req.session || !req.session.username) {
        res.json({ success: false, error: 'unauthorized' });
        return null;
    }
    return req.session.username;
}

router.get('/', (req, res) => {
    const agent = requireAgent(req, res);
    if (!agent) return;

    try {
        let row = db.prepare("SELECT * FROM agent_bonus_settings WHERE agent_username = ?").get(agent);

        if (!row) {
            db.prepare("INSERT INTO agent_bonus_settings (agent_username) VALUES (?)").run(agent);
            row = db.prepare("SELECT * FROM agent_bonus_settings WHERE agent_username = ?").get(agent);
        }

        res.json({ success: true, settings: row });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/', (req, res) => {
    const agent = requireAgent(req, res);
    if (!agent) return;

    const inData = req.body || {};

    try {
        // make sure the row exists first
        db.prepare("INSERT OR IGNORE INTO agent_bonus_settings (agent_username) VALUES (?)").run(agent);

        const set = [];
        const vals = [];
        for (const f of FIELDS) {
            if (Object.prototype.hasOwnProperty.call(inData, f)) {
                set.push(`${f} = ?`);
                vals.push(inData[f]);
            }
        }

        if (set.length === 0) {
            return res.json({ success: false, error: 'no fields provided' });
        }

        set.push("updated_at = datetime('now')");
        vals.push(agent);

        const sql = `UPDATE agent_bonus_settings SET ${set.join(', ')} WHERE agent_username = ?`;
        db.prepare(sql).run(...vals);

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.all('/', (req, res) => {
    res.json({ success: false, error: 'method not allowed' });
});

module.exports = router;