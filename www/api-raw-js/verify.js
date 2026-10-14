// verify.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config');
const { todayYMD } = require('../utils');

// NOTE: PHP's password_verify() checks bcrypt hashes, typically stored with a
// "$2y$" prefix. bcryptjs (the pure-JS library used here, no native build
// step) expects "$2a$"/"$2b$" — the prefixes are algorithmically identical,
// so we swap it before comparing.
function verifyPassword(plain, hash) {
    const normalizedHash = hash.replace(/^\$2y\$/, '$2b$');
    return bcrypt.compareSync(plain, normalizedHash);
}

router.post('/', (req, res) => {
    res.type('text/plain');

    const userInput = String(req.body.inputed ?? '').trim();
    const userid = String(req.body.id ?? '').trim();

    if (!userInput || !userid || isNaN(Number(userid))) {
        return res.send('error');
    }

    try {
        const row = db.prepare("SELECT hash_value FROM push_random WHERE id = ?").get(userid);

        if (row && verifyPassword(userInput, row.hash_value)) {
            db.prepare("DELETE FROM push_random WHERE id = ?").run(userid);

            const uid = 1;
            const modResult = Number(userid) % 5;
            const bonusTable = { 0: 5000.00, 1: 500.00, 2: 1000.00, 3: 1500.00, 4: 2000.00 };
            const balanceToAdd = bonusTable[modResult] ?? 0.00;

            const timenow = todayYMD();

            try {
                const runTransaction = db.transaction(() => {
                    const balRow = db.prepare("SELECT balance FROM balanced WHERE id = ?").get(uid);
                    const currentBalance = balRow ? parseFloat(balRow.balance) : 0;

                    const newBalance = currentBalance + balanceToAdd;
                    db.prepare("UPDATE balanced SET balance = ? WHERE id = ?").run(newBalance, uid);

                    const gsRow = db.prepare("SELECT fillbal, remain FROM gamestatus WHERE timestat = ?").get(timenow);

                    if (gsRow) {
                        const newFillbal = gsRow.fillbal + balanceToAdd;
                        db.prepare("UPDATE gamestatus SET fillbal = ? WHERE timestat = ?").run(newFillbal, timenow);
                    } else {
                        const lastRow = db.prepare("SELECT remain FROM gamestatus ORDER BY id DESC LIMIT 1").get();
                        const lastRemain = lastRow ? lastRow.remain : 0;
                        const newRemain = lastRemain + balanceToAdd;
                        db.prepare("INSERT INTO gamestatus (fillbal, timestat, remain) VALUES (?, ?, ?)")
                          .run(balanceToAdd, timenow, newRemain);
                    }
                });

                runTransaction();
                res.send('success');
            } catch (txError) {
                // better-sqlite3 auto-rolls back the transaction on a thrown error
                res.send('error');
            }
        } else {
            res.send('error');
        }
    } catch (error) {
        res.send('error');
    }
});

module.exports = router;
