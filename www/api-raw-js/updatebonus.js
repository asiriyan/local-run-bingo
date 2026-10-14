// updatebonus.js
const express = require('express');
const router = express.Router();
const { db } = require('../config');

router.post('/', (req, res) => {
    const data = req.body;

    if (data.bonus === undefined || data.fulldate === undefined) {
        return res.json({ error: 'Missing required parameters' });
    }

    const bonus = parseFloat(data.bonus);
    const fulldate = data.fulldate;

    try {
        const row = db.prepare("SELECT * FROM gamestatus WHERE timestat = ? LIMIT 1").get(fulldate);

        if (row) {
            const earnAfterBonus = parseFloat(row.earn) - bonus;
            db.prepare("UPDATE gamestatus SET earn = ? WHERE timestat = ?").run(earnAfterBonus, fulldate);
        } else {
            const negativeBonus = -Math.abs(bonus);
            db.prepare("INSERT INTO gamestatus (earn, timestat) VALUES (?, ?)").run(negativeBonus, fulldate);
        }

        res.json({ success: true, message: 'Bonus processed successfully' });
    } catch (error) {
        res.json({ error: `An error occurred: ${error.message}` });
    }
});

module.exports = router;
